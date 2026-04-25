import mongoose from 'mongoose';
import Asset from '../models/Asset.js';
import AssetVersion, { AssetVersionStatus } from '../models/AssetVersion.js';
import UploadSession, { UploadSessionStatus } from '../models/UploadSession.js';
import s3Client, { 
  S3_BUCKET, 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand 
} from '../config/s3.js';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getPresignedUrl } from '@aws-sdk/s3-request-presigner';
import logger, { serializeError } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// ─────────────────────────────────────────────────────────────
// 🔴 RED: S3 operations use dummy/stubbed responses when
//         AWS credentials are not configured. Replace env vars
//         S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
//         before going live.
// ─────────────────────────────────────────────────────────────

const DEFAULT_PART_SIZE = 10 * 1024 * 1024; // 10 MB
const DIRECT_UPLOAD_THRESHOLD = 20 * 1024 * 1024; // 20 MB
const UPLOAD_EXPIRY_HOURS = 24;
const UPLOADS_DIR = process.cwd();
const CHUNKS_DIR = path.resolve('uploads/chunks');

function isS3Disabled() {
  // Allow explicit override via env or fallback if creds are missing
  if (process.env.STORAGE_PROVIDER === 'local') return true;
  return !process.env.AWS_ACCESS_KEY_ID || 
         process.env.AWS_ACCESS_KEY_ID === 'DUMMY_ACCESS_KEY_ID' ||
         process.env.AWS_ACCESS_KEY_ID === process.env.AWS_SECRET_ACCESS_KEY; // Detect placeholder/malformed creds
}

/**
 * Start a resumable multipart upload session.
 */
export async function startUpload(
  userId: string,
  fileName: string,
  fileSize: number,
  mimeType: string = 'application/octet-stream'
) {
  // Create Asset + AssetVersion
  const asset = await Asset.create({
    ownerUserId: userId,
    originalName: fileName,
    mimeType,
    sizeBytes: fileSize,
  });

  const storageKey = `uploads/${userId}/${asset._id}/${Date.now()}-${fileName}`;
  const totalParts = Math.ceil(fileSize / DEFAULT_PART_SIZE);

  const assetVersion = await AssetVersion.create({
    assetId: asset._id,
    storageKey,
    sizeBytes: fileSize,
    status: AssetVersionStatus.UPLOADING,
    versionNumber: 1,
  });

  asset.latestVersionId = assetVersion._id;
  await asset.save();

  // ─── 2. Provider Initialization ────────────────────────────
  let s3Disabled = isS3Disabled();
  let providerUploadId = `local-${Date.now()}`;
  const presignedUrls: string[] = [];
  const isDirect = fileSize < DIRECT_UPLOAD_THRESHOLD;

  if (!s3Disabled) {
    try {
      logger.info('upload.s3_init_start', { bucket: S3_BUCKET, key: storageKey, isDirect });
      if (isDirect) {
        // Direct PutObject (much faster for small files)
        const cmd = new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: storageKey,
          ContentType: mimeType,
          ChecksumAlgorithm: undefined,
        });
        const url = await getPresignedUrl(s3Client, cmd, { expiresIn: 3600 });
        presignedUrls.push(url);
        providerUploadId = 'direct-put'; // Skip Multipart ID
      } else {
        // Multi-part (better for large files / reliability)
        const cmd = new CreateMultipartUploadCommand({
          Bucket: S3_BUCKET,
          Key: storageKey,
          ContentType: mimeType,
        });
        const result = await s3Client.send(cmd);
        providerUploadId = result.UploadId!;
        logger.info('upload.s3_multipart_created', { uploadId: providerUploadId });

        // Generate presigned URLs for each part
        for (let i = 1; i <= totalParts; i++) {
          const partCmd = new UploadPartCommand({
            Bucket: S3_BUCKET,
            Key: storageKey,
            PartNumber: i,
            UploadId: providerUploadId,
            ChecksumAlgorithm: undefined,
          });
          const url = await getPresignedUrl(s3Client, partCmd, { expiresIn: 3600 });
          presignedUrls.push(url);
        }
      }
    } catch (err) {
      logger.error('upload.s3_init_failed_falling_back_to_local', { error: serializeError(err) });
      s3Disabled = true; // Fallback to local storage
      providerUploadId = `local-${Date.now()}`;
      presignedUrls.length = 0; // Clear any partial URLs
    }
  }

  if (s3Disabled) {
    // Local fallback: presigned URLs point to our own API
    const baseUrl = process.env.VITE_API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const partCount = isDirect ? 1 : totalParts;
    for (let i = 1; i <= partCount; i++) {
       presignedUrls.push(`${baseUrl}/api/v1/uploads/local-part/PENDING/${i}?u=${providerUploadId}`);
    }
  }

  const session = await UploadSession.create({
    assetVersionId: assetVersion._id,
    providerUploadId,
    partSizeBytes: isDirect ? fileSize : DEFAULT_PART_SIZE,
    totalParts: isDirect ? 1 : totalParts,
    status: UploadSessionStatus.ACTIVE,
    expiresAt: new Date(Date.now() + UPLOAD_EXPIRY_HOURS * 60 * 60 * 1000),
  });

  // If local, update the PENDING URLs with the actual sessionId
  if (s3Disabled) {
    for (let i = 0; i < presignedUrls.length; i++) {
      presignedUrls[i] = presignedUrls[i].replace('PENDING', session._id.toString());
    }
  }

  return {
    uploadSessionId: session._id,
    assetId: asset._id,
    presignedUrls,
    partSizeBytes: isDirect ? fileSize : DEFAULT_PART_SIZE,
    totalParts: isDirect ? 1 : totalParts,
    isDirect,
  };
}

/**
 * Register an uploaded part.
 */
export async function registerPart(
  sessionId: string,
  partNumber: number,
  etag: string,
  sizeBytes: number = 0
) {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new Error('Upload session not found');
  if (session.status !== UploadSessionStatus.ACTIVE) {
    throw new Error('Upload session is not active');
  }

  // De-duplicate: check if part already registered
  const existingPart = session.partsUploaded.find(p => p.partNumber === partNumber);
  if (existingPart) return session;

  // Check for placeholder ETags (common if CORS is misconfigured)
  if (etag.startsWith('part-')) {
    logger.warn('upload.placeholder_etag_received', { sessionId, partNumber, etag });
  }

  session.partsUploaded.push({ partNumber, etag, sizeBytes });
  await session.save();

  return session;
}

/**
 * Finalize an upload — complete S3 multipart + seal the asset version.
 */
export async function finalizeUpload(sessionId: string) {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new Error('Upload session not found');

  // Idempotent: already completed
  if (session.status === UploadSessionStatus.COMPLETED) {
    const assetVersion = await AssetVersion.findById(session.assetVersionId);
    return { assetVersion };
  }

  if (session.status !== UploadSessionStatus.ACTIVE) {
    throw new Error('Upload session is not active');
  }

  const assetVersion = await AssetVersion.findById(session.assetVersionId);
  if (!assetVersion) throw new Error('AssetVersion not found');

  if (!isS3Disabled()) {
    // ─── 1. S3 Finalization ───────────────────────────────────
    // ONLY call CompleteMultipartUpload if we actually had a multipart session
    if (session.providerUploadId !== 'direct-put') {
      try {
        const parts = session.partsUploaded
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(p => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          }));
        
        logger.info('upload.s3_finalize_attempt', { 
          uploadId: session.providerUploadId, 
          partsCount: parts.length,
          storageKey: assetVersion.storageKey 
        });

        const cmd = new CompleteMultipartUploadCommand({
          Bucket: S3_BUCKET,
          Key: assetVersion.storageKey,
          UploadId: session.providerUploadId,
          MultipartUpload: { Parts: parts },
        });
        await s3Client.send(cmd);
      } catch (err) {
        logger.error('upload.s3_finalize_failed', { 
          uploadId: session.providerUploadId,
          error: serializeError(err) 
        });
        throw new Error('S3 completion failed. This often happens if the ETag header was not exposed in S3 CORS settings.');
      }
    }
  } else {
    // ─── 2. Local Finalization (Zip/Merge Chunks) ──────────────
    const finalPath = path.join(UPLOADS_DIR, assetVersion.storageKey);
    const sessionChunksDir = path.join(CHUNKS_DIR, session._id.toString());

    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    const sortedParts = session.partsUploaded.sort((a, b) => a.partNumber - b.partNumber);
    const writeStream = createWriteStream(finalPath);

    for (const part of sortedParts) {
      const partPath = path.join(sessionChunksDir, part.partNumber.toString());
      try {
        await fs.access(partPath);
        await pipeline(createReadStream(partPath), writeStream, { end: false });
      } catch (err) {
        writeStream.destroy();
        logger.error('upload.local_finalize_missing_part', { sessionId: session._id, partNumber: part.partNumber });
        throw new Error(`Part ${part.partNumber} is missing from disk. Cannot finalize.`);
      }
    }
    writeStream.end();

    // Cleanup chunks
    await fs.rm(sessionChunksDir, { recursive: true, force: true });
  }

  // Seal the asset version
  assetVersion.status = AssetVersionStatus.SEALED;
  await assetVersion.save();

  session.status = UploadSessionStatus.COMPLETED;
  await session.save();

  logger.info('upload.finalized', {
    sessionId,
    assetVersionId: assetVersion?._id?.toString(),
  });

  const url = await getAssetDownloadUrl(assetVersion.assetId.toString());

  return { assetVersion, url };
}

export async function getUploadStatus(sessionId: string) {
  const session = await UploadSession.findById(sessionId).lean();
  if (!session) throw new Error('Upload session not found');
  return {
    status: session.status,
    totalParts: session.totalParts,
    uploadedPartNumbers: session.partsUploaded.map(p => p.partNumber),
    isComplete: session.status === UploadSessionStatus.COMPLETED,
  };
}

/**
 * Get resume configuration (fresh presigned URLs for missing chunks).
 */
export async function resumeUploadSession(sessionId: string) {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new Error('Upload session not found');
  if (session.status !== UploadSessionStatus.ACTIVE) throw new Error('Session not active');

  const assetVersion = await AssetVersion.findById(session.assetVersionId);
  if (!assetVersion) throw new Error('AssetVersion not found');

  const providerUploadId = session.providerUploadId;
  const storageKey = assetVersion.storageKey;
  const totalParts = session.totalParts;
  
  const uploadedPartNumbers = session.partsUploaded.map(p => p.partNumber);
  const presignedUrls: Record<number, string> = {};
  if (session.providerUploadId === 'direct-put' || session.totalParts === 1) {
    // Single-put complete: handled by the upload to presigned URL. 
    // We just mark it here.
    session.status = UploadSessionStatus.COMPLETED;
    await session.save();

    const version = await AssetVersion.findById(session.assetVersionId);
    if (version) {
      version.status = AssetVersionStatus.READY;
      await version.save();
    }
    return { success: true };
  }

  const s3Disabled = isS3Disabled();
  const baseUrl = process.env.VITE_API_URL || `http://localhost:${process.env.PORT || 5000}`;

  for (let i = 1; i <= totalParts; i++) {
    if (!uploadedPartNumbers.includes(i)) {
      if (!s3Disabled) {
        const partCmd = new UploadPartCommand({
          Bucket: S3_BUCKET,
          Key: storageKey,
          PartNumber: i,
          UploadId: providerUploadId,
          ChecksumAlgorithm: undefined,
        });
        presignedUrls[i] = await getPresignedUrl(s3Client, partCmd, { expiresIn: 3600 });
      } else {
        presignedUrls[i] = `${baseUrl}/api/v1/uploads/local-part/${session._id}/${i}?u=${providerUploadId}`;
      }
    }
  }

  return {
    uploadSessionId: session._id,
    assetId: assetVersion.assetId,
    partSizeBytes: session.partSizeBytes,
    totalParts,
    uploadedPartNumbers,
    presignedUrls, // mapping of partNumber -> url
  };
}

/**
 * Create a new version for an existing asset (used for deliverable revisions).
 */
export async function createNewVersion(assetId: string, userId: string, fileName: string, fileSize: number, mimeType?: string) {
  const asset = await Asset.findById(assetId);
  if (!asset) throw new Error('Asset not found');

  const lastVersion = await AssetVersion.findOne({ assetId }).sort({ versionNumber: -1 });
  const newVersionNumber = (lastVersion?.versionNumber || 0) + 1;

  const storageKey = `uploads/${userId}/${assetId}/v${newVersionNumber}-${fileName}`;

  const assetVersion = await AssetVersion.create({
    assetId,
    storageKey,
    sizeBytes: fileSize,
    status: AssetVersionStatus.UPLOADING,
    versionNumber: newVersionNumber,
  });

  asset.latestVersionId = assetVersion._id;
  if (mimeType) asset.mimeType = mimeType;
  asset.sizeBytes = fileSize;
  await asset.save();

  // Start a new upload session for this version
  const totalParts = Math.ceil(fileSize / DEFAULT_PART_SIZE);

  const session = await UploadSession.create({
    assetVersionId: assetVersion._id,
    providerUploadId: `stub-${Date.now()}`,
    partSizeBytes: DEFAULT_PART_SIZE,
    totalParts,
    status: UploadSessionStatus.ACTIVE,
    expiresAt: new Date(Date.now() + UPLOAD_EXPIRY_HOURS * 60 * 60 * 1000),
  });

  return {
    uploadSessionId: session._id,
    assetVersionId: assetVersion._id,
    versionNumber: newVersionNumber,
  };
}

/**
 * Validate a local part upload before saving.
 */
export async function validateLocalPartUpload(sessionId: string, providerUploadId: string) {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new Error('Upload session not found');
  if (session.providerUploadId !== providerUploadId) {
    throw new Error('Invalid upload ID for this session');
  }
  if (session.status !== UploadSessionStatus.ACTIVE) {
    throw new Error('Upload session is no longer active');
  }
  return session;
}

/**
 * Save a chunk of data locally for a session.
 */
export async function saveLocalPart(sessionId: string, partNumber: number, data: Buffer) {
  const session = await UploadSession.findById(sessionId);
  if (!session) throw new Error('Session not found');

  const sessionChunksDir = path.join(CHUNKS_DIR, sessionId);
  await fs.mkdir(sessionChunksDir, { recursive: true });

  const partPath = path.join(sessionChunksDir, partNumber.toString());
  await fs.writeFile(partPath, data);

  logger.debug('upload.local_part_saved', { sessionId, partNumber, size: data.length });

  return { success: true };
}

/**
 * Generates a temporary URL for viewing/downloading an asset.
 */
export async function getAssetDownloadUrl(assetId: string): Promise<string> {
  const asset = await Asset.findById(assetId);
  if (!asset) throw new Error('Asset not found');

  const version = await AssetVersion.findById(asset.latestVersionId);
  if (!version) throw new Error('Asset version not found');

  if (isS3Disabled()) {
    return `/api/v1/uploads/view/${assetId}`;
  }

  const s3Client = (await import('../config/s3.js')).default;
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: version.storageKey,
  });

  return getPresignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Deletes an asset and its file from storage.
 */
export async function deleteAsset(assetId: string): Promise<void> {
  const asset = await Asset.findById(assetId);
  if (!asset) return;

  const version = await AssetVersion.findById(asset.latestVersionId);
  if (version) {
    if (isS3Disabled()) {
      const filePath = path.join(process.cwd(), version.storageKey);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        logger.warn('upload.local_delete_failed', { assetId, path: filePath, error: serializeError(err) });
      }
    } else {
      const s3Client = (await import('../config/s3.js')).default;
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: version.storageKey,
        }));
      } catch (err) {
        logger.warn('upload.s3_delete_failed', { assetId, key: version.storageKey, error: serializeError(err) });
      }
    }
    await AssetVersion.deleteOne({ _id: version._id });
  }

  await Asset.deleteOne({ _id: assetId });
  logger.info('upload.asset_deleted', { assetId, originalName: asset.originalName });
}
