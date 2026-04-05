import { z } from 'zod';
import { OrderItemStatus } from '../models/OrderItem.ts';

// ─── Review Order (Gap 2) ─────────────────────────────────────
export const reviewOrderSchema = z.object({
    action: z.enum(['ACCEPT', 'REJECT', 'REQUEST_INFO'] as const),
});

// ─── Assign Order (Gap 3) ─────────────────────────────────────
export const assignOrderSchema = z.object({
    staffId: z.string().min(1, 'staffId is required'),
});

// ─── Transition Item Status (Gap 5) ───────────────────────────
// Cast enum values to a tuple so Zod can build a typed enum from them.
const itemStatusValues = Object.values(OrderItemStatus) as [
    OrderItemStatus,
    ...OrderItemStatus[]
];

export const transitionStatusSchema = z.object({
    status: z.enum(itemStatusValues),
});

// ─── Update Support Status ────────────────────────────────────
export const updateSupportStatusSchema = z.object({
    status: z.enum(['open', 'in_progress', 'resolved', 'closed'] as const),
});

export type ReviewOrderInput          = z.infer<typeof reviewOrderSchema>;
export type AssignOrderInput          = z.infer<typeof assignOrderSchema>;
export type TransitionStatusInput     = z.infer<typeof transitionStatusSchema>;
export type UpdateSupportStatusInput  = z.infer<typeof updateSupportStatusSchema>;
