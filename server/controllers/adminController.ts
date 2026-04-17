import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import * as orderService from '../services/orderService.js';
import * as supportService from '../services/supportService.js';
import * as userService from '../services/userService.js';
import { OrderItemStatus } from '../models/OrderItem.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import {
    reviewOrderSchema,
    assignOrderSchema,
    transitionStatusSchema,
    updateSupportStatusSchema,
} from '../validators/adminValidator.js';

// ─── Dashboard Statistics (Gap 4: single $facet round-trip) ───
export const getDashboardStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
    // One aggregation replaces four separate countDocuments calls.
    // $facet runs all branches in parallel on the DB side — one network round-trip.
    const [result] = await Order.aggregate([
        {
            $facet: {
                totalOrders:   [{ $count: 'count' }],
                pendingReview: [{ $match: { status: 'UNDER_REVIEW' } }, { $count: 'count' }],
                inProgress:    [{ $match: { status: 'IN_PROGRESS' } }, { $count: 'count' }],
                completed:     [{ $match: { status: 'COMPLETED' } }, { $count: 'count' }],
            },
        },
    ]);

    res.json({
        success: true,
        data: {
            totalOrders:   result.totalOrders[0]?.count   ?? 0,
            pendingReview: result.pendingReview[0]?.count ?? 0,
            inProgress:    result.inProgress[0]?.count    ?? 0,
            completed:     result.completed[0]?.count     ?? 0,
        },
    });
});

// ─── List All Orders ───────────────────────────────────────────
export const listAllOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const status = req.query.status as string | undefined;
    const page = Number(req.query.page || '1');
    const limit = Math.min(Number(req.query.limit || '20'), 100); // cap at 100
    const result = await orderService.listAllOrders(status, page, limit);
    res.json({ success: true, data: result });
});

// ─── Review Order (Gap 2: validated action) ───────────────────
export const reviewOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { action } = reviewOrderSchema.parse(req.body); // throws 400 on bad action
    const id = req.params.id as string;
    const order = await orderService.reviewOrder(id, req.user!._id.toString(), action);
    res.json({ success: true, data: order });
});

// ─── Assign Order (Gap 3: verified staffId) ───────────────────
export const assignOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { staffId } = assignOrderSchema.parse(req.body);

    // Verify the target user exists and is staff/admin — never trust the client
    const staffMember = await User.findOne({ _id: staffId, role: { $in: ['admin', 'staff'] } }).lean();
    if (!staffMember) {
        res.status(404);
        throw new Error('Staff member not found or user is not staff/admin');
    }

    const id = req.params.id as string;
    const order = await orderService.assignOrder(id, req.user!._id.toString(), staffId);
    res.json({ success: true, data: order });
});

// ─── Transition Item Status (Gap 5: validated status enum) ────
export const transitionItemStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = transitionStatusSchema.parse(req.body); // throws 400 on invalid status
    const iid = req.params.iid as string;
    const item = await orderService.transitionItemStatus(iid, status as OrderItemStatus, req.user!._id.toString());
    res.json({ success: true, data: item });
});

// ─── Deliver Item ──────────────────────────────────────────────
export const deliverItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const iid = req.params.iid as string;
    const item = await orderService.deliverItem(iid, req.user!._id.toString());
    res.json({ success: true, data: item });
});

// ─── Refund Failed Item ───────────────────────────────────────
export const refundItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const iid = req.params.iid as string;
    const item = await orderService.refundItem(iid, req.user!._id.toString());
    res.json({ success: true, data: item });
});

// ─── Support: List Tickets (Gap 6) ───────────────────────────
export const listTickets = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page  = Number(req.query.page  || '1');
    const limit = Math.min(Number(req.query.limit || '20'), 100);
    const result = await supportService.listTickets(page, limit);
    res.json({ success: true, data: result });
});

// ─── Support: List Bug Reports (Gap 6) ───────────────────────
export const listBugReports = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page  = Number(req.query.page  || '1');
    const limit = Math.min(Number(req.query.limit || '20'), 100);
    const result = await supportService.listBugReports(page, limit);
    res.json({ success: true, data: result });
});

// ─── Support: Update Ticket Status (Gap 6) ───────────────────
export const updateTicketStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = updateSupportStatusSchema.parse(req.body);
    const id = req.params.id as string;
    const ticket = await supportService.updateSupportStatus(id, status);
    res.json({ success: true, data: { ticket } });
});

// ─── Support: Update Bug Report Status (Gap 6) ───────────────
export const updateBugReportStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = updateSupportStatusSchema.parse(req.body);
    const id = req.params.id as string;
    const bugReport = await supportService.updateSupportStatus(id, status);
    res.json({ success: true, data: { bugReport } });
});

// ─── List Staff ───────────────────────────────────────────────
export const listStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const staff = await userService.listStaff();
    res.json({ success: true, data: { staff } });
});

// ─── List Users ───────────────────────────────────────────────
export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page  = Number(req.query.page  || '1');
    const limit = Math.min(Number(req.query.limit || '20'), 100);
    const search = req.query.search as string || '';
    const result = await userService.listUsers(page, limit, search, req.user!._id.toString());
    res.json({ success: true, data: result });
});

// ─── Get User Detail ────────────────────────────────────────────
export const getUserDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.params.id;
    const detail = await userService.getUserDetail(userId);
    res.json({ success: true, data: detail });
});

// ─── Assign Staff ─────────────────────────────────────────────
export const assignStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const user = await userService.assignStaff(userId);
    res.json({ success: true, data: { user } });
});

// ─── Remove Staff ─────────────────────────────────────────────
export const removeStaff = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const user = await userService.removeStaff(userId);
    res.json({ success: true, data: { user } });
});
