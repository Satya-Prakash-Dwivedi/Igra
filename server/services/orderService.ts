import mongoose from 'mongoose';
import Order, { OrderStatus, ORDER_TRANSITIONS } from '../models/Order.ts';
import OrderItem, { OrderItemKind, OrderItemStatus, ITEM_TRANSITIONS } from '../models/OrderItem.ts';
import AssetLink, { AssetRole } from '../models/AssetLink.ts';
import { SERVICE_CATALOG } from '../config/serviceCatalog.ts';
import { validateOrderItemParams } from '../validators/orderItemParams.ts';
import { computePricingSnapshot } from './pricingService.ts';
import * as creditService from './creditService.ts';
import * as auditService from './auditService.ts';
import { LedgerReason, LedgerRefType } from '../models/CreditLedgerEntry.ts';
import { generateOrderNumber } from '../utils/generateOrderNumber.ts';

// ─── Create Draft Order ───────────────────────────────────────
export async function createOrder(userId: string, idempotencyKey: string, title?: string) {
  // Idempotency: if order with this key exists, return it
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return existing;

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    userId,
    idempotencyKey,
    title: title || '',
    status: OrderStatus.DRAFT,
  });

  await auditService.appendOrderEvent(order._id.toString(), 'ORDER_CREATED', { title }, userId);
  return order;
}

// ─── Add Item to Draft Order ──────────────────────────────────
export async function addItem(
  orderId: string,
  userId: string,
  kind: OrderItemKind,
  params: Record<string, any>,
  dependsOnItemIds: string[] = [],
  assetIds: string[] = []
) {
  const order = await Order.findOne({ _id: orderId, userId, status: OrderStatus.DRAFT });
  if (!order) throw new Error('Order not found or not in DRAFT status');

  // Validate params
  const validation = validateOrderItemParams(kind, params);
  if (!validation.success) {
    throw new Error(`Invalid params: ${JSON.stringify(validation.error)}`);
  }

  // Compute pricing server-side
  const validatedParams = validation.data as Record<string, any>;
  const pricingSnapshot = computePricingSnapshot(kind, validatedParams);
  const serviceDef = SERVICE_CATALOG[kind];

  const item = await OrderItem.create({
    orderId,
    kind,
    params: validatedParams,
    pricingSnapshot,
    creditsQuoted: pricingSnapshot.totalCredits,
    allowedRevisions: serviceDef.defaultRevisions,
    dependsOnItemIds: dependsOnItemIds.map(id => new mongoose.Types.ObjectId(id)),
    status: dependsOnItemIds.length > 0 ? OrderItemStatus.BLOCKED : OrderItemStatus.PENDING_INPUT,
  });

  // Create AssetLinks
  if (assetIds.length > 0) {
    await AssetLink.create(assetIds.map((assetId, index) => ({
      orderItemId: item._id,
      assetId: new mongoose.Types.ObjectId(assetId),
      role: AssetRole.INPUT,
      orderIndex: index
    })));
  }

  // Recalculate order total
  const items = await OrderItem.find({ orderId });
  order.totalCreditsQuoted = items.reduce((sum, i) => sum + i.creditsQuoted, 0);
  await order.save();

  await auditService.appendItemEvent(item._id.toString(), 'ITEM_ADDED', { kind, creditsQuoted: pricingSnapshot.totalCredits }, userId);

  return item;
}

// ─── Remove Item from Draft Order ──────────────────────────────
export async function removeItem(orderId: string, itemId: string, userId: string) {
  const order = await Order.findOne({ _id: orderId, userId, status: OrderStatus.DRAFT });
  if (!order) throw new Error('Order not found or not in DRAFT status');

  await OrderItem.findByIdAndDelete(itemId);

  // Recalculate order total
  const items = await OrderItem.find({ orderId });
  order.totalCreditsQuoted = items.reduce((sum, i) => sum + i.creditsQuoted, 0);
  await order.save();

  await auditService.appendOrderEvent(orderId, 'ITEM_REMOVED', { itemId }, userId);
  return order;
}

// ─── Add Asset To Item ────────────────────────────────────────
export async function addAssetToItem(orderId: string, itemId: string, userId: string, assetIds: string[]) {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new Error('Order not found');

  const item = await OrderItem.findOne({ _id: itemId, orderId });
  if (!item) throw new Error('Item not found');

  if (assetIds.length > 0) {
    const existingLinks = await AssetLink.find({ orderItemId: item._id, role: AssetRole.INPUT })
      .sort({ orderIndex: -1 })
      .limit(1);
    const startIndex = existingLinks.length > 0 ? (existingLinks[0].orderIndex || 0) + 1 : 0;

    await AssetLink.create(assetIds.map((assetId, index) => ({
      orderItemId: item._id,
      assetId: new mongoose.Types.ObjectId(assetId),
      role: AssetRole.INPUT,
      orderIndex: startIndex + index
    })));
  }

  await auditService.appendItemEvent(itemId, 'ASSETS_ADDED', { count: assetIds.length }, userId);

  return item;
}

// ─── Submit Order (Capture Credits) ───────────────────────────
export async function submitOrder(orderId: string, userId: string, idempotencyKey: string) {
  const order = await Order.findOne({ _id: orderId, userId, status: OrderStatus.DRAFT });
  if (!order) throw new Error('Order not found or not in DRAFT status');

  const items = await OrderItem.find({ orderId });
  if (items.length === 0) throw new Error('Order has no items');

  const totalCredits = items.reduce((sum, item) => sum + item.creditsQuoted, 0);
  const wallet = await creditService.getOrCreateWallet(userId);

  // Debit credits (idempotent)
  await creditService.appendLedgerEntry({
    walletId: wallet._id,
    delta: -totalCredits,
    reason: LedgerReason.ORDER_CAPTURE,
    refType: LedgerRefType.ORDER,
    refId: new mongoose.Types.ObjectId(orderId),
    idempotencyKey,
  });

  // Transition to UNDER_REVIEW
  order.status = OrderStatus.UNDER_REVIEW;
  order.totalCreditsCaptured = totalCredits;
  order.submittedAt = new Date();
  await order.save();

  // Mark all PENDING_INPUT items as READY (if no deps)
  await OrderItem.updateMany(
    { orderId, status: OrderItemStatus.PENDING_INPUT, dependsOnItemIds: { $size: 0 } },
    { status: OrderItemStatus.READY }
  );

  await auditService.appendOrderEvent(orderId, 'SUBMITTED', { totalCredits }, userId);
  return order;
}

// ─── Admin: Review Order ──────────────────────────────────────
export async function reviewOrder(
  orderId: string,
  adminId: string,
  action: 'ACCEPT' | 'REJECT' | 'REQUEST_INFO'
) {
  const order = await Order.findOne({ _id: orderId, status: OrderStatus.UNDER_REVIEW });
  if (!order) throw new Error('Order not found or not under review');

  if (action === 'ACCEPT') {
    order.status = OrderStatus.IN_PROGRESS;
    order.assignedTo = new mongoose.Types.ObjectId(adminId);
    await order.save();
    await auditService.appendOrderEvent(orderId, 'ACCEPTED', {}, adminId);
  } else if (action === 'REJECT') {
    order.status = OrderStatus.CANCELLED;
    await order.save();
    await auditService.appendOrderEvent(orderId, 'REJECTED', {}, adminId);
    // Refund credits
    const wallet = await creditService.getOrCreateWallet(order.userId.toString());
    await creditService.appendLedgerEntry({
      walletId: wallet._id,
      delta: order.totalCreditsCaptured,
      reason: LedgerReason.REFUND,
      refType: LedgerRefType.ORDER,
      refId: order._id,
      idempotencyKey: `refund-order-${orderId}`,
    });
  } else if (action === 'REQUEST_INFO') {
    await auditService.appendOrderEvent(orderId, 'INFO_REQUESTED', {}, adminId);
  }

  return order;
}

// ─── Admin: Assign Order ──────────────────────────────────────
export async function assignOrder(orderId: string, adminId: string, staffId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  order.assignedTo = new mongoose.Types.ObjectId(staffId);
  await order.save();
  await auditService.appendOrderEvent(orderId, 'ASSIGNED', { staffId }, adminId);
  return order;
}

// ─── Admin: Transition Item Status ────────────────────────────
export async function transitionItemStatus(
  orderItemId: string,
  newStatus: OrderItemStatus,
  actorId: string
) {
  const item = await OrderItem.findById(orderItemId);
  if (!item) throw new Error('Item not found');

  const allowed = ITEM_TRANSITIONS[item.status as OrderItemStatus];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${item.status} to ${newStatus}`);
  }

  const oldStatus = item.status;
  item.status = newStatus;
  await item.save();

  await auditService.appendItemEvent(orderItemId, 'STATUS_CHANGED', { from: oldStatus, to: newStatus }, actorId);

  // Check if all items are delivered → move order to AWAITING_APPROVAL
  await syncOrderStatus(item.orderId.toString(), actorId);

  return item;
}

// ─── Admin: Deliver Item ──────────────────────────────────────
export async function deliverItem(orderItemId: string, adminId: string) {
  return transitionItemStatus(orderItemId, OrderItemStatus.DELIVERED, adminId);
}

// ─── User: Approve Item ───────────────────────────────────────
export async function approveItem(orderItemId: string, userId: string) {
  const item = await OrderItem.findById(orderItemId);
  if (!item) throw new Error('Item not found');
  if (item.status !== OrderItemStatus.DELIVERED) {
    throw new Error('Item must be DELIVERED to approve');
  }

  item.status = OrderItemStatus.APPROVED;
  await item.save();

  await auditService.appendItemEvent(orderItemId, 'APPROVED', {}, userId);
  await syncOrderStatus(item.orderId.toString(), userId);

  return item;
}

// ─── User: Request Revision ───────────────────────────────────
export async function requestRevision(orderItemId: string, userId: string, notes?: string) {
  const item = await OrderItem.findById(orderItemId);
  if (!item) throw new Error('Item not found');
  if (item.status !== OrderItemStatus.DELIVERED) {
    throw new Error('Item must be DELIVERED to request revision');
  }
  if (item.usedRevisions >= item.allowedRevisions) {
    throw new Error(`Revision limit reached (${item.allowedRevisions}). A new paid item is required.`);
  }

  item.usedRevisions += 1;
  item.status = OrderItemStatus.IN_PROGRESS;
  await item.save();

  await auditService.appendItemEvent(orderItemId, 'REVISION_REQUESTED', {
    usedRevisions: item.usedRevisions,
    allowedRevisions: item.allowedRevisions,
    notes,
  }, userId);

  // Move order back to IN_PROGRESS if it was in AWAITING_APPROVAL
  const order = await Order.findById(item.orderId);
  if (order && order.status === OrderStatus.AWAITING_APPROVAL) {
    order.status = OrderStatus.IN_PROGRESS;
    await order.save();
    await auditService.appendOrderEvent(order._id.toString(), 'REVISION_REOPENED', { itemId: orderItemId }, userId);
  }

  return item;
}

// ─── Admin: Refund Failed Item ────────────────────────────────
export async function refundItem(orderItemId: string, adminId: string) {
  const item = await OrderItem.findById(orderItemId);
  if (!item) throw new Error('Item not found');
  if (item.status !== OrderItemStatus.FAILED) {
    throw new Error('Only FAILED items can be refunded');
  }

  const order = await Order.findById(item.orderId);
  if (!order) throw new Error('Order not found');

  const wallet = await creditService.getOrCreateWallet(order.userId.toString());
  await creditService.appendLedgerEntry({
    walletId: wallet._id,
    delta: item.creditsQuoted,
    reason: LedgerReason.REFUND,
    refType: LedgerRefType.ORDER,
    refId: item._id,
    idempotencyKey: `refund-item-${orderItemId}`,
  });

  await auditService.appendItemEvent(orderItemId, 'REFUNDED', { creditsRefunded: item.creditsQuoted }, adminId);

  return item;
}

// ─── Cancel Order ─────────────────────────────────────────────
export async function cancelOrder(orderId: string, actorId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  const cancellable: OrderStatus[] = [OrderStatus.DRAFT, OrderStatus.PENDING_PAYMENT, OrderStatus.UNDER_REVIEW, OrderStatus.IN_PROGRESS];
  if (!cancellable.includes(order.status as OrderStatus)) {
    throw new Error(`Cannot cancel order in ${order.status} status`);
  }

  order.status = OrderStatus.CANCELLED;
  await order.save();

  // Cancel all non-terminal items
  await OrderItem.updateMany(
    { orderId, status: { $nin: [OrderItemStatus.APPROVED, OrderItemStatus.FAILED, OrderItemStatus.CANCELLED] } },
    { status: OrderItemStatus.CANCELLED }
  );

  // Refund captured credits if any were captured
  if (order.totalCreditsCaptured > 0) {
    const wallet = await creditService.getOrCreateWallet(order.userId.toString());
    await creditService.appendLedgerEntry({
      walletId: wallet._id,
      delta: order.totalCreditsCaptured,
      reason: LedgerReason.REFUND,
      refType: LedgerRefType.ORDER,
      refId: order._id,
      idempotencyKey: `refund-cancel-${orderId}`,
    });
  }

  await auditService.appendOrderEvent(orderId, 'CANCELLED', {}, actorId);
  return order;
}

// ─── Get Order with Items ─────────────────────────────────────
export async function getOrderDetail(orderId: string) {
  const order = await Order.findById(orderId)
    .populate('userId', 'name email avatar')
    .populate('assignedTo', 'name email avatar')
    .lean();
  if (!order) throw new Error('Order not found');

  const itemsRaw = await OrderItem.find({ orderId }).lean();
  
  // Attach assets to each item
  const items = await Promise.all(itemsRaw.map(async (item) => {
    const assetLinks = await AssetLink.find({ orderItemId: item._id })
      .sort({ orderIndex: 1 })
      .populate('assetId')
      .lean();
    return {
      ...item,
      assets: assetLinks.map((al: any) => ({
        ...al.assetId,
        role: al.role,
        orderIndex: al.orderIndex
      }))
    };
  }));

  const events = await auditService.getOrderTimeline(orderId);

  return { order, items, events };
}

// ─── List Orders ──────────────────────────────────────────────
export async function listOrders(userId: string, status?: string, page = 1, limit = 20) {
  const filter: Record<string, any> = { userId };
  if (status) filter.status = status;

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Order.countDocuments(filter);

  // Attach item count per order
  const ordersWithCounts = await Promise.all(
    orders.map(async (o) => {
      const itemCount = await OrderItem.countDocuments({ orderId: o._id });
      return { ...o, itemCount };
    })
  );

  return { orders: ordersWithCounts, total, page, limit };
}

// ─── Admin: List All Orders ───────────────────────────────────
export async function listAllOrders(status?: string, page = 1, limit = 20) {
  const filter: Record<string, any> = {};
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('assignedTo', 'name email')
      .lean(),
    Order.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limit);

  return { orders, total, page, pages };
}


// ─── Internal: Sync Order Status Based on Items ───────────────
async function syncOrderStatus(orderId: string, actorId: string) {
  const order = await Order.findById(orderId);
  if (!order) return;

  const items = await OrderItem.find({ orderId });
  if (items.length === 0) return;

  const allDelivered = items.every(i =>
    i.status === OrderItemStatus.DELIVERED || i.status === OrderItemStatus.APPROVED
  );
  const allApproved = items.every(i => i.status === OrderItemStatus.APPROVED);

  if (allApproved && order.status !== OrderStatus.COMPLETED) {
    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    await order.save();
    await auditService.appendOrderEvent(orderId, 'COMPLETED', {}, actorId);
  } else if (allDelivered && order.status === OrderStatus.IN_PROGRESS) {
    order.status = OrderStatus.AWAITING_APPROVAL;
    await order.save();
    await auditService.appendOrderEvent(orderId, 'AWAITING_APPROVAL', {}, actorId);
  }
}
