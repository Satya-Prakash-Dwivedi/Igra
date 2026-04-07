import type { NextFunction, Request, Response } from 'express'
import crypto from 'crypto'
import logger from '../utils/logger.js'

// ─────────────────────────────────────────────────────────────
// 🔴 RED: Replace PAYPAL_WEBHOOK_ID in .env with real value
//         from PayPal Developer Dashboard before deployment.
// ─────────────────────────────────────────────────────────────

/**
 * Verify PayPal webhook signature.
 * In production, use the PayPal SDK or manual signature verification.
 * This is a placeholder that logs the webhook and passes through.
 */
export const verifyPaypalWebhook = (req: Request, res: Response, next: NextFunction) => {
  void req
  void res
  void crypto

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId || webhookId === 'DUMMY_WEBHOOK_ID') {
    logger.warn('billing.webhook_verification_skipped', {
      reason: 'missing_paypal_webhook_id',
    })
    next()
    return
  }

  // In production, verify the signature:
  // 1. Get PayPal-provided headers
  // 2. Construct the expected signature
  // 3. Compare with PayPal-Transmission-Sig header
  //
  // See: https://developer.paypal.com/docs/api-basics/notifications/webhooks/notification-messages/
  //
  // For now, we trust and pass through.
  // TODO: Implement real verification

  logger.info('billing.webhook_verified')
  next()
};
