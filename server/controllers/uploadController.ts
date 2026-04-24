import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import * as uploadService from '../services/uploadService.js';
import * as orderService from '../services/orderService.js';
import Asset from '../models/Asset.js';
import AssetVersion from '../models/AssetVersion.js';
import path from 'path';
import fs from 'fs';

// ─── Start Upload ─────────────────────────────────────────────
export const startUpload = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fileName, fileSize, mimeType } = req.body;
  const result = await uploadService.startUpload(req.user!._id.toString(), fileName, fileSize, mimeType);
  res.status(201).json({ success: true, data: result });
});

// ─── Register Part ────────────────────────────────────────────
export const registerPart = asyncHandler(async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { partNumber, etag, sizeBytes } = req.body;
  const session = await uploadService.registerPart(sessionId, partNumber, etag, sizeBytes);
  res.json({ success: true, data: session });
});

// ─── Finalize Upload ──────────────────────────────────────────
export const finalizeUpload = asyncHandler(async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const result = await uploadService.finalizeUpload(sessionId);
  res.json({ success: true, data: result });
});

// ─── Get Upload Status ────────────────────────────────────────
export const getUploadStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const status = await uploadService.getUploadStatus(sessionId);
  res.json({ success: true, data: status });
});

// ─── Resume Upload ────────────────────────────────────────────
export const resumeUpload = asyncHandler(async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const result = await uploadService.resumeUploadSession(sessionId);
  res.json({ success: true, data: result });
});

// ─── Handle Local Part Upload ─────────────────────────────────
export const handleLocalPartUpload = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sessionId, partNumber } = req.params;
  const data = req.body;

  if (!data || !Buffer.isBuffer(data)) {
    logger.error('upload.local_part_invalid_body', { 
      sessionId, 
      partNumber, 
      bodyType: typeof data,
      isBuffer: Buffer.isBuffer(data),
      contentType: req.headers['content-type']
    });
    res.status(400).json({ error: 'No binary data received. Ensure Content-Type matches the upload proxy configuration.' });
    return;
  }

  if (data.length === 0) {
    res.status(400).json({ error: 'Received an empty data chunk.' });
    return;
  }

  const uploadId = req.query.u as string;
  await uploadService.validateLocalPartUpload(sessionId as string, uploadId);

  await uploadService.saveLocalPart(sessionId as string, parseInt(partNumber as string), data);
  res.json({ success: true });
});

// ─── View Asset (Stream or Redirect) ──────────────────────────
export const viewAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
  const assetId = req.params.assetId as string;
  const url = await uploadService.getAssetDownloadUrl(assetId);

  if (url.startsWith('http')) {
    // S3: Redirect to the signed URL
    res.redirect(url);
  } else {
    // Local: Stream the file from disk
    const asset = await Asset.findById(assetId);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    const version = await AssetVersion.findById(asset.latestVersionId);
    if (!version) {
      res.status(404).json({ error: 'Asset version not found' });
      return;
    }

    const filePath = path.join(process.cwd(), version.storageKey);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on storage' });
      return;
    }

    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${asset.originalName}"`);
    fs.createReadStream(filePath).pipe(res);
  }
});

export const removeAsset = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { oid, iid, aid } = req.params;
  const result = await orderService.removeAssetFromItem(
    oid as string,
    iid as string,
    req.user!._id.toString(),
    aid as string
  );
  res.json(result);
});
