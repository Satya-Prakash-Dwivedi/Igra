import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import asyncHandler from 'express-async-handler';
import * as uploadService from '../services/uploadService.ts';

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
