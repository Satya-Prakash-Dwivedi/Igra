import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

/**
 * Idempotency middleware.
 * Extracts X-Idempotency-Key from request header and attaches it to req.
 * Required for POST endpoints that must be exactly-once (create order, submit, purchase).
 */
export const requireIdempotencyKey = (req: AuthRequest, res: Response, next: NextFunction) => {
  const key = req.headers['x-idempotency-key'] as string;
  if (!key) {
    res.status(400).json({
      success: false,
      error: 'X-Idempotency-Key header is required',
    });
    return;
  }
  (req as any).idempotencyKey = key;
  next();
};

/**
 * Optional idempotency key — extracts if present, doesn't require it.
 */
export const optionalIdempotencyKey = (req: AuthRequest, res: Response, next: NextFunction) => {
  const key = req.headers['x-idempotency-key'] as string;
  if (key) {
    (req as any).idempotencyKey = key;
  }
  next();
};
