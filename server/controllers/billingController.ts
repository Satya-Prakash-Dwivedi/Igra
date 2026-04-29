import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import * as billingService from '../services/billingService.js';
import { CREDIT_PACKS } from '../config/serviceCatalog.js';

// ─── Get Credit Packs ─────────────────────────────────────────
export const getCreditPacks = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: CREDIT_PACKS });
});

// ─── Create Purchase ──────────────────────────────────────────
export const createPurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { packId, amountDollars } = req.body;
  const result = await billingService.createPurchase(
    req.user!._id.toString(),
    packId,
    (req as any).idempotencyKey as string,
    amountDollars
  );
  res.status(201).json({ success: true, data: result });
});

// ─── Capture Purchase ─────────────────────────────────────────
export const capturePurchase = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const payment = await billingService.capturePurchase(id, req.user!._id.toString());
  res.json({ success: true, data: payment });
});

// ─── List Invoices ────────────────────────────────────────────
export const listInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page || '1');
  const limit = Number(req.query.limit || '20');
  const result = await billingService.listInvoices(req.user!._id.toString(), page, limit);
  res.json({ success: true, data: result });
});

// ─── Get Invoice Detail ───────────────────────────────────────
export const getInvoiceDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const invoice = await billingService.getInvoiceDetail(id, req.user!._id.toString());
  res.json({ success: true, data: invoice });
});

// ─── PayPal Webhook ───────────────────────────────────────────
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { event_type, resource } = req.body;
  const paypalOrderId = resource?.id || resource?.supplementary_data?.related_ids?.order_id;
  if (paypalOrderId) {
    await billingService.handlePayPalWebhook(paypalOrderId, event_type);
  }
  res.status(200).json({ received: true });
});
