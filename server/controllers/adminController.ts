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
import * as creditService from '../services/creditService.js';
import CreditLedgerEntry, { LedgerReason, LedgerRefType } from '../models/CreditLedgerEntry.js';
import CreditWallet from '../models/CreditWallet.js';

// ─── Dashboard Statistics ───────────────────────────────────────
export const getDashboardStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [result] = await Order.aggregate([
        {
            $facet: {
                totalOrders:   [{ $count: 'count' }],
                statusCounts:  [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                averageRating: [{ $match: { rating: { $exists: true, $ne: null } } }, { $group: { _id: null, avg: { $avg: '$rating' } } }],
                revenue30Days: [
                    { $match: { submittedAt: { $gte: thirtyDaysAgo } } },
                    { $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
                        total: { $sum: "$totalCreditsCaptured" }
                    }},
                    { $sort: { _id: 1 } }
                ]
            },
        },
    ]);

    // Fill in missing days for a smooth 30-day chart
    const revenueMap = new Map<string, number>();
    result.revenue30Days.forEach((item: any) => {
        revenueMap.set(item._id, item.total || 0);
    });

    const revenueTimeline = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        revenueTimeline.push({
            date: dateStr,
            revenue: revenueMap.get(dateStr) || 0
        });
    }

    const statusMap = new Map<string, number>();
    result.statusCounts.forEach((item: any) => {
        statusMap.set(item._id, item.count);
    });

    // ─── Operational Metrics ───────────────────────────────────────
    const now = new Date();
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const activeStatuses = ['PENDING_PAYMENT', 'UNDER_REVIEW', 'IN_PROGRESS', 'FINALIZING', 'AWAITING_APPROVAL'];

    const urgentOrders = await Order.find({
        status: { $in: activeStatuses },
        customDeadline: { $exists: true, $ne: null, $lte: fortyEightHoursFromNow } // Includes overdue and up to 48h from now, ignores null
    }).populate('assignedTo', 'name').populate('userId', 'name').sort({ customDeadline: 1 }).limit(10);

    const staffWorkload = await Order.aggregate([
        { $match: { status: { $in: activeStatuses }, assignedTo: { $exists: true, $ne: null } } },
        { $group: { _id: "$assignedTo", activeOrders: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staff' } },
        { $unwind: "$staff" },
        { $project: { staffId: "$_id", name: "$staff.name", activeOrders: 1, _id: 0 } },
        { $sort: { activeOrders: -1 } }
    ]);

    res.json({
        success: true,
        data: {
            totalOrders:   result.totalOrders[0]?.count   ?? 0,
            pendingReview: statusMap.get('UNDER_REVIEW') ?? 0,
            inProgress:    statusMap.get('IN_PROGRESS')  ?? 0,
            completed:     statusMap.get('COMPLETED')    ?? 0,
            draft:         statusMap.get('DRAFT')        ?? 0,
            pendingPayment:statusMap.get('PENDING_PAYMENT') ?? 0,
            finalizing:    statusMap.get('FINALIZING')   ?? 0,
            awaitingApproval: statusMap.get('AWAITING_APPROVAL') ?? 0,
            cancelled:     statusMap.get('CANCELLED')    ?? 0,
            averageRating: result.averageRating[0]?.avg   ?? 0,
            revenueTimeline,
            urgentOrders,
            staffWorkload,
        },
    });
});

// ─── List Orders ───────────────────────────────────────────────────
export const listAllOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const status = req.query.status as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;
    const page = Number(req.query.page || '1');
    const limit = Number(req.query.limit || '10');

    const result = await orderService.listAllOrders(status, assignedTo, page, limit);
    res.json({ success: true, data: result });
});

// ─── Custom Order Deadline ────────────────────────────────────────
export const updateOrderDeadline = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    const { deadline } = req.body; // ISO date string or null
    
    let parsedDeadline: Date | null = null;
    if (deadline) {
        parsedDeadline = new Date(deadline);
        if (isNaN(parsedDeadline.getTime())) {
            res.status(400);
            throw new Error('Invalid deadline date');
        }
    } else {
        parsedDeadline = undefined as any; // to unset or let mongoose handle null? Wait, we can use $unset or $set.
    }
    
    const updateQuery = deadline ? { $set: { customDeadline: parsedDeadline } } : { $unset: { customDeadline: 1 } };
    
    const order = await Order.findByIdAndUpdate(
        id,
        updateQuery,
        { new: true }
    );
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }
    
    res.json({ success: true, data: { order } });
});

// ─── Review Order (Gap 2: validated action) ───────────────────
export const reviewOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { action } = reviewOrderSchema.parse(req.body); // throws 400 on bad action
    const id = req.params.id as string;
    const order = await orderService.reviewOrder(id, req.user!._id.toString(), action);
    res.json({ success: true, data: { order } });
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
    let order = await orderService.assignOrder(id, req.user!._id.toString(), staffId);
    
    // Populate assignedTo for the frontend
    order = (await Order.findById(order._id).populate('assignedTo', 'name email avatar'))!;

    res.json({ success: true, data: { order } });
});

// ─── Transition Item Status (Gap 5: validated status enum) ────
export const transitionItemStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = transitionStatusSchema.parse(req.body); // throws 400 on invalid status
    const iid = req.params.iid as string;
    const oid = req.params.oid as string;
    await orderService.transitionItemStatus(iid, status as OrderItemStatus, req.user!._id.toString());
    const updatedOrder = await orderService.getOrderDetail(oid);
    const updatedItem = updatedOrder.items.find(i => i._id.toString() === iid);
    res.json({ success: true, data: { item: updatedItem } });
});

// ─── Deliver Item ──────────────────────────────────────────────
export const deliverItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const iid = req.params.iid as string;
    const oid = req.params.oid as string;
    await orderService.deliverItem(iid, req.user!._id.toString());
    const updatedOrder = await orderService.getOrderDetail(oid);
    const updatedItem = updatedOrder.items.find(i => i._id.toString() === iid);
    res.json({ success: true, data: { item: updatedItem } });
});

// ─── Add Asset To Item ────────────────────────────────────────
export const addAssetToItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const oid = req.params.oid as string;
    const iid = req.params.iid as string;
    const { assetIds, role } = req.body;
    await orderService.addAssetToItem(oid, iid, req.user!._id.toString(), assetIds || [], role);
    const updatedOrder = await orderService.getOrderDetail(oid);
    const updatedItem = updatedOrder.items.find(i => i._id.toString() === iid);
    res.json({ success: true, data: { item: updatedItem } });
});

export const removeAssetFromItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const oid = req.params.oid as string;
    const iid = req.params.iid as string;
    const assetId = req.params.assetId as string;
    await orderService.removeAssetFromItem(oid, iid, req.user!._id.toString(), assetId);
    const updatedOrder = await orderService.getOrderDetail(oid);
    const updatedItem = updatedOrder.items.find(i => i._id.toString() === iid);
    res.json({ success: true, data: { item: updatedItem } });
});

// ─── Delivery Links ───────────────────────────────────────────
export const addDeliveryLink = asyncHandler(async (req: AuthRequest, res: Response) => {
    const iid = req.params.iid as string;
    const { link } = req.body;
    if (!link) throw new Error('Link is required');
    
    const OrderItem = (await import('../models/OrderItem.js')).default;
    const item = await OrderItem.findById(iid);
    if (!item) {
        res.status(404);
        throw new Error('Item not found');
    }

    // Push link to deliveryLinks array
    await OrderItem.findByIdAndUpdate(iid, { $addToSet: { deliveryLinks: link } });
    
    const updated = await orderService.getOrderDetail(item.orderId.toString());
    const updatedItem = updated.items.find(i => i._id.toString() === iid);

    res.json({ success: true, data: { item: updatedItem } });
});

export const removeDeliveryLink = asyncHandler(async (req: AuthRequest, res: Response) => {
    const iid = req.params.iid as string;
    const { link } = req.body;
    if (!link) throw new Error('Link is required');
    
    const OrderItem = (await import('../models/OrderItem.js')).default;
    const item = await OrderItem.findById(iid);
    if (!item) {
        res.status(404);
        throw new Error('Item not found');
    }

    await OrderItem.findByIdAndUpdate(iid, { $pull: { deliveryLinks: link } });
    
    const updated = await orderService.getOrderDetail(item.orderId.toString());
    const updatedItem = updated.items.find(i => i._id.toString() === iid);

    res.json({ success: true, data: { item: updatedItem } });
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
    const userId = req.params.id as string;
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
    const user = await userService.getUserDetail(userId);
    res.json({ success: true, data: { user } });
});

// ─── Grant Credits ────────────────────────────────────────────────
export const grantCredits = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.params.id as string;
    const { amount, notes } = req.body;
    
    if (typeof amount !== 'number' || amount <= 0) {
        res.status(400);
        throw new Error('Invalid amount');
    }
    
    const wallet = await creditService.getOrCreateWallet(userId);
    
    const entry = await creditService.appendLedgerEntry({
        walletId: wallet._id.toString(),
        delta: amount,
        reason: LedgerReason.ADJUSTMENT,
        refType: LedgerRefType.ADMIN,
        refId: req.user!._id.toString(),
        notes: notes || undefined,
        idempotencyKey: `admin-grant-${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    });
    
    res.json({ success: true, data: { entry, newBalance: entry.balanceAfter } });
});

// ─── Global Ledger ────────────────────────────────────────────────
export const listGlobalLedger = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Number(req.query.page || '1');
    const limit = Number(req.query.limit || '20');
    const reason = req.query.reason as string | undefined;
    const search = req.query.search as string | undefined;
    
    const query: any = {};
    if (reason) {
        query.reason = reason;
    }
    
    if (search) {
        const users = await User.find({
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        }).select('_id');
        
        const userIds = users.map(u => u._id);
        const wallets = await CreditWallet.find({ userId: { $in: userIds } }).select('_id');
        const walletIds = wallets.map(w => w._id);
        
        query.walletId = { $in: walletIds };
    }
    
    const entries = await CreditLedgerEntry.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
            path: 'walletId',
            populate: {
                path: 'userId',
                select: 'name email avatar'
            }
        });
        
    const total = await CreditLedgerEntry.countDocuments(query);
    
    res.json({
        success: true,
        data: { entries, total, page, limit }
    });
});
