import { z } from 'zod';

// ─── Ticket ───────────────────────────────────────────────────
export const createTicketSchema = z.object({
    category: z.enum([
        'Order Problem',
        'Billing Issue',
        'Technical Issue',
        'Feature Request',
        'Other',
    ] as const),
    message: z
        .string()
        .min(1, 'Message cannot be empty')
        .max(5000, 'Message cannot exceed 5000 characters'),
    attachmentAssetIds: z.array(z.string()).optional().default([]),
});

// ─── Bug Report ───────────────────────────────────────────────
export const createBugReportSchema = z.object({
    description: z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description cannot exceed 5000 characters'),
    screenshotAssetIds: z.array(z.string()).optional().default([]),
    wantsFollowUp: z.boolean().optional().default(false),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type CreateBugReportInput = z.infer<typeof createBugReportSchema>;
