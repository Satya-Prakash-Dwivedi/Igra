import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import asyncHandler from 'express-async-handler';
import * as orderService from '../services/orderService.ts';
import { OrderItemKind } from '../models/OrderItem.ts';

// ─── Create Draft Order ───────────────────────────────────────
export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.createOrder(
    req.user!._id.toString(),
    (req as any).idempotencyKey as string,
    req.body.title
  );
  res.status(201).json({ success: true, data: order });
});

// ─── List My Orders ───────────────────────────────────────────
export const listOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const page = Number(req.query.page || '1');
  const limit = Number(req.query.limit || '20');
  const result = await orderService.listOrders(req.user!._id.toString(), status, page, limit);
  res.json({ success: true, data: result });
});

// ─── Get Order Detail ─────────────────────────────────────────
export const getOrderDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const result = await orderService.getOrderDetail(id);
  res.json({ success: true, data: result });
});

// ─── Add Item to Order ────────────────────────────────────────
export const addItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { kind, params, dependsOnItemIds, assetIds } = req.body;
  const item = await orderService.addItem(id, req.user!._id.toString(), kind as OrderItemKind, params, dependsOnItemIds, assetIds);
  res.status(201).json({ success: true, data: item });
});

// ─── Remove Item from Order ───────────────────────────────────
export const removeItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const iid = req.params.iid as string;
  const order = await orderService.removeItem(id, iid, req.user!._id.toString());
  res.json({ success: true, data: order });
});

// ─── Add Asset To Item ────────────────────────────────────────
export const addAssetToItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string; // in routes this might be :oid
  const oid = req.params.oid as string || id;
  const iid = req.params.iid as string;
  const { assetIds } = req.body;
  const item = await orderService.addAssetToItem(oid, iid, req.user!._id.toString(), assetIds || []);
  res.status(200).json({ success: true, data: item });
});

// ─── Submit Order ─────────────────────────────────────────────
export const submitOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const order = await orderService.submitOrder(id, req.user!._id.toString(), (req as any).idempotencyKey as string);
  res.json({ success: true, data: order });
});

// ─── Cancel Order ─────────────────────────────────────────────
export const cancelOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const order = await orderService.cancelOrder(id, req.user!._id.toString());
  res.json({ success: true, data: order });
});

// ─── Approve Item ─────────────────────────────────────────────
export const approveItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const iid = req.params.iid as string;
  const item = await orderService.approveItem(iid, req.user!._id.toString());
  res.json({ success: true, data: item });
});

// ─── Request Revision ─────────────────────────────────────────
export const requestRevision = asyncHandler(async (req: AuthRequest, res: Response) => {
  const iid = req.params.iid as string;
  const item = await orderService.requestRevision(iid, req.user!._id.toString(), req.body.notes);
  res.json({ success: true, data: item });
});
