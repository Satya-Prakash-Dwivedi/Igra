import mongoose from 'mongoose';
import Asset from '../models/Asset.ts';
import AssetVersion, { AssetVersionStatus } from '../models/AssetVersion.ts';
import UploadSession, { UploadSessionStatus } from '../models/UploadSession.ts';
import s3Client, { S3_BUCKET, CreateMultipartUploadCommand, getSignedUrl } from '../config/s3.ts';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getPresignedUrl } from '@aws-sdk/s3-request-presigner';
import logger, { serializeError } from '../utils/logger.ts';

// ─────────────────────────────────────────────────────────────
// 🔴 RED: S3 operations use dummy/stubbed responses when
//         AWS credentials are not configured. Replace env vars
//         S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
//         before going live.
// ─────────────────────────────────────────────────────────────

const DEFAULT_PART_SIZE = 10 * 1024 * 1024; // 10 MB
const UPLOAD_EXPIRY_HOURS = 24;

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

  // 🔴 RED: Replace with real S3 CreateMultipartUpload when credentials ready
  let providerUploadId = `stub-upload-${Date.now()}`;
  const presignedUrls: string[] = [];

  try {
    const cmd = new CreateMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: storageKey,
      ContentType: mimeType,
    });
    const result = await s3Client.send(cmd);
    providerUploadId = result.UploadId || providerUploadId;

    // Generate presigned URLs for each part
    for (let i = 1; i <= totalParts; i++) {
      const url = `https://${S3_BUCKET}.s3.amazonaws.com/${storageKey}?partNumber=${i}&uploadId=${providerUploadId}`;
      presignedUrls.push(url);
    }
  } catch (err) {
    logger.warn('upload.multipart_stub_mode', {
      fileName,
      userId,
      storageKey,
      error: serializeError(err),
    });
    // Stub: generate fake presigned URLs for development
    for (let i = 1; i <= totalParts; i++) {
      presignedUrls.push(`http://localhost:9000/stub/${storageKey}?part=${i}`);
    }
  }

  const session = await UploadSession.create({
    assetVersionId: assetVersion._id,
    providerUploadId,
    partSizeBytes: DEFAULT_PART_SIZE,
    totalParts,
    status: UploadSessionStatus.ACTIVE,
    expiresAt: new Date(Date.now() + UPLOAD_EXPIRY_HOURS * 60 * 60 * 1000),
  });

  return {
    uploadSessionId: session._id,
    assetId: asset._id,
    presignedUrls,
    partSizeBytes: DEFAULT_PART_SIZE,
    totalParts,
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

  // 🔴 RED: Replace with real S3 CompleteMultipartUpload
  // const cmd = new CompleteMultipartUploadCommand({ ... });
  // await s3Client.send(cmd);

  // Seal the asset version
  const assetVersion = await AssetVersion.findById(session.assetVersionId);
  if (assetVersion) {
    assetVersion.status = AssetVersionStatus.SEALED;
    await assetVersion.save();
  }

  session.status = UploadSessionStatus.COMPLETED;
  await session.save();

  logger.info('upload.finalized', {
    sessionId,
    assetVersionId: assetVersion?._id?.toString(),
  });

  return { assetVersion };
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

  // Stub generating presigned URLs for missing parts
  for (let i = 1; i <= totalParts; i++) {
    if (!uploadedPartNumbers.includes(i)) {
      presignedUrls[i] = `https://${S3_BUCKET}.s3.amazonaws.com/${storageKey}?partNumber=${i}&uploadId=${providerUploadId}`;
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
