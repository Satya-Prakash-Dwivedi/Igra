import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import asyncHandler from 'express-async-handler';
import * as orderService from '../services/orderService.ts';
import { OrderItemStatus } from '../models/OrderItem.ts';
import Order from '../models/Order.ts';

// ─── Admin: List All Orders ───────────────────────────────────
export const listAllOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const page = Number(req.query.page || '1');
  const limit = Number(req.query.limit || '20');
  const result = await orderService.listAllOrders(status, page, limit);
  res.json({ success: true, data: result });
});

// ─── Admin: Review Order ──────────────────────────────────────
export const reviewOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { action } = req.body;
  const order = await orderService.reviewOrder(id, req.user!._id.toString(), action);
  res.json({ success: true, data: order });
});

// ─── Admin: Assign Order ──────────────────────────────────────
export const assignOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { staffId } = req.body;
  const order = await orderService.assignOrder(id, req.user!._id.toString(), staffId);
  res.json({ success: true, data: order });
});

// ─── Admin: Transition Item Status ────────────────────────────
export const transitionItemStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const iid = req.params.iid as string;
  const { status } = req.body;
  const item = await orderService.transitionItemStatus(iid, status as OrderItemStatus, req.user!._id.toString());
  res.json({ success: true, data: item });
});

// ─── Admin: Deliver Item ──────────────────────────────────────
export const deliverItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const iid = req.params.iid as string;
  const item = await orderService.deliverItem(iid, req.user!._id.toString());
  res.json({ success: true, data: item });
});

// ─── Admin: Refund Item ───────────────────────────────────────
export const refundItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const iid = req.params.iid as string;
  const item = await orderService.refundItem(iid, req.user!._id.toString());
  res.json({ success: true, data: item });
});

// ─── Admin: Dashboard Stats ───────────────────────────────────
export const getDashboardStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [totalOrders, pendingReview, inProgress, completed] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ status: 'UNDER_REVIEW' }),
    Order.countDocuments({ status: 'IN_PROGRESS' }),
    Order.countDocuments({ status: 'COMPLETED' }),
  ]);
  res.json({ success: true, data: { totalOrders, pendingReview, inProgress, completed } });
});
