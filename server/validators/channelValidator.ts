import { z } from 'zod';

// Validates a single CSS hex color string (e.g. "#e11d48" or "#fff")
const hexColor = z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Each brand color must be a valid hex color (e.g. #fff or #e11d48)');

const paceEnum = z.enum(['Slow', 'Normal', 'Fast', 'Super']);
const toneEnum = z.enum(['Funny', 'Elegant', 'Serious', 'Casual', 'Professional', 'Informational']);

// ─── Create Schema (name + channelUrl required) ───────────────
export const createChannelSchema = z.object({
    name: z.string().min(1, 'Channel name is required').max(256),
    channelUrl: z.string().url('channelUrl must be a valid URL'),
    logo: z.string().url('logo must be a valid URL').optional(),
    brandColors: z
        .tuple([hexColor, hexColor, hexColor])
        .optional(),
    pace: paceEnum.optional(),
    tone: toneEnum.optional(),
    description: z.string().max(2000).optional(),
});

// ─── Update Schema (all optional, PATCH semantics) ────────────
export const updateChannelSchema = z.object({
    name: z.string().min(1).max(256).optional(),
    channelUrl: z.string().url('channelUrl must be a valid URL').optional(),
    logo: z.string().url('logo must be a valid URL').optional(),
    brandColors: z
        .tuple([hexColor, hexColor, hexColor])
        .optional(),
    pace: paceEnum.optional(),
    tone: toneEnum.optional(),
    description: z.string().max(2000).optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
