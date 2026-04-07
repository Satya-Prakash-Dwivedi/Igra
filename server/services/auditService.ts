import OrderEvent from '../models/OrderEvent.js';
import ItemEvent from '../models/ItemEvent.js';

/**
 * Append an order-level audit event.
 */
export async function appendOrderEvent(
  orderId: string,
  type: string,
  data: Record<string, any>,
  actorId: string
) {
  return OrderEvent.create({ orderId, type, data, actorId });
}

/**
 * Append an item-level audit event.
 */
export async function appendItemEvent(
  orderItemId: string,
  type: string,
  data: Record<string, any>,
  actorId: string
) {
  return ItemEvent.create({ orderItemId, type, data, actorId });
}

/**
 * Get order events timeline.
 */
export async function getOrderTimeline(orderId: string) {
  return OrderEvent.find({ orderId }).sort({ createdAt: 1 }).lean();
}

/**
 * Get item events timeline.
 */
export async function getItemTimeline(orderItemId: string) {
  return ItemEvent.find({ orderItemId }).sort({ createdAt: 1 }).lean();
}
