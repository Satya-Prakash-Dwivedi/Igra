import { z } from 'zod';
import { OrderItemKind } from '../models/OrderItem.js';

// ─── Per-Kind Parameter Validators ────────────────────────────

const genericParams = z.object({
  uploadType: z.enum(['file', 'link']).optional(),
  uploadLink: z.string().optional(),
  externalLinks: z.array(z.string()).optional(),
  assetIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const videoEditParams = genericParams.extend({
  packageTier: z.enum(['BASIC', 'STANDARD', 'PREMIUM']).default('BASIC'),
  deliverySpeed: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
  videoFormat: z.string().optional(),
  videoLength: z.number().optional(),
  style: z.string().optional(),
  pace: z.string().optional(),
});

const thumbnailParams = genericParams.extend({
  style: z.string().min(1, 'Style is required'),
});

const voiceoverParams = genericParams.extend({
  scriptLength: z.number().min(1, 'Script length is required (minutes)'),
});

const scriptParams = genericParams.extend({
  wordCount: z.number().min(50, 'Minimum 50 words required'),
});

const seoParams = genericParams.extend({
  videoUrl: z.string().url('A valid video URL is required'),
});

const consultationParams = genericParams.extend({
  duration: z.number().default(15),
});

const footageReviewParams = genericParams.extend({
  footageLength: z.number().min(1, 'Footage length is required (minutes)'),
});

const customParams = genericParams.extend({
  description: z.string().min(10, 'Description must be at least 10 chars'),
});

// ─── Validator Map ────────────────────────────────────────────

export const ORDER_ITEM_VALIDATORS: Record<OrderItemKind, z.ZodType> = {
  [OrderItemKind.VIDEO_EDIT]:       videoEditParams,
  [OrderItemKind.GAMING_STREAMS]:   videoEditParams,
  [OrderItemKind.THUMBNAIL]:        thumbnailParams,
  [OrderItemKind.INTRO]:            genericParams,
  [OrderItemKind.OUTRO]:            genericParams,
  [OrderItemKind.VOICEOVER]:        voiceoverParams,
  [OrderItemKind.SCRIPT]:           scriptParams,
  [OrderItemKind.SEO]:              seoParams,
  [OrderItemKind.CHANNEL_BANNER]:   genericParams,
  [OrderItemKind.LOGO_DESIGN]:      genericParams,
  [OrderItemKind.IMAGE_RETOUCHING]: genericParams,
  [OrderItemKind.CONSULTATION]:     consultationParams,
  [OrderItemKind.FOOTAGE_REVIEW]:   footageReviewParams,
  [OrderItemKind.CUSTOM]:           customParams,
};

export function validateOrderItemParams(kind: OrderItemKind, params: unknown) {
  const validator = ORDER_ITEM_VALIDATORS[kind];
  if (!validator) {
    return { success: false as const, error: `Unknown service kind: ${kind}` };
  }
  const result = validator.safeParse(params);
  if (!result.success) {
    return { success: false as const, error: result.error.flatten().fieldErrors };
  }
  return { success: true as const, data: result.data };
}
