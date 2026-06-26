import type { NextFunction, Request, Response } from 'express'
import crypto from 'crypto'
import logger from '../utils/logger.js'

/**
 * Verify Razorpay webhook signature.
 * Uses X-Razorpay-Signature header against RAZORPAY_WEBHOOK_SECRET.
 * Assumes express.raw() has placed raw Buffer in req.body.
 */
export const verifyRazorpayWebhook = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || secret === 'DUMMY_WEBHOOK_SECRET') {
    logger.warn('billing.razorpay_webhook_verification_skipped', {
      reason: 'missing_razorpay_webhook_secret',
    });
    // If Buffer, parse to JSON for controller
    if (Buffer.isBuffer(req.body)) {
      try {
        req.body = JSON.parse(req.body.toString('utf8'));
      } catch (err) {
        // ignore
      }
    }
    next();
    return;
  }

  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) {
    res.status(401).json({ error: 'Missing Razorpay webhook signature header' });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    logger.warn('billing.razorpay_webhook_signature_mismatch');
    res.status(401).json({ error: 'Invalid Razorpay webhook signature' });
    return;
  }

  // Parse Buffer to JSON object for downstream controller
  if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON payload in webhook body' });
      return;
    }
  }

  logger.info('billing.razorpay_webhook_verified');
  next();
};
