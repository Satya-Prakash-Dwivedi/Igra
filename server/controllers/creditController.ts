import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import * as creditService from '../services/creditService.js';

// ─── Get Wallet ───────────────────────────────────────────────
export const getWallet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const wallet = await creditService.getOrCreateWallet(req.user!._id.toString());
  res.json({ success: true, data: { balance: wallet.balance, currency: wallet.currency } });
});

// ─── Get Ledger ───────────────────────────────────────────────
export const getLedger = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const result = await creditService.getLedgerEntries(
    req.user!._id.toString(),
    Number(page),
    Number(limit)
  );
  res.json({ success: true, data: result });
});
