import { OrderItemKind } from '../models/OrderItem.js';

// ─── Service Definition ───────────────────────────────────────
export interface ServiceDef {
  label: string;
  baseCredits: number;
  perMinuteCredits?: number;
  defaultRevisions: number;
  requiredParams: string[];
  description: string;
  pricingText: string;
}

// ─── Static Service Catalog ───────────────────────────────────
// This replaces the old Service mongoose model.
// Pricing and required inputs per service kind.
export const SERVICE_CATALOG: Record<OrderItemKind, ServiceDef> = {
  [OrderItemKind.VIDEO_EDIT]: {
    label: 'Talking head/Vlog',
    baseCredits: 70,
    defaultRevisions: 2,
    requiredParams: ['packageTier', 'deliverySpeed'],
    description: 'Professional video editing with tiered packages',
    pricingText: 'From 70 credits',
  },
  [OrderItemKind.GAMING_STREAMS]: {
    label: 'Gaming/Streams',
    baseCredits: 60,
    defaultRevisions: 2,
    requiredParams: ['packageTier', 'deliverySpeed'],
    description: 'Professional post-production for gaming content',
    pricingText: 'From 60 credits',
  },
  [OrderItemKind.THUMBNAIL]: {
    label: 'Thumbnail Design',
    baseCredits: 10,
    defaultRevisions: 3,
    requiredParams: ['style'],
    description: 'Eye-catching thumbnail design',
    pricingText: '10 credits per thumbnail',
  },
  [OrderItemKind.INTRO]: {
    label: 'Custom Intro',
    baseCredits: 20,
    defaultRevisions: 2,
    requiredParams: [],
    description: 'Custom animated intro for your channel',
    pricingText: '20 credits',
  },
  [OrderItemKind.CHANNEL_BANNER]: {
    label: 'Channel Banner',
    baseCredits: 15,
    defaultRevisions: 2,
    requiredParams: [],
    description: 'Professional channel banner design',
    pricingText: '15 credits',
  },
  [OrderItemKind.CONSULTATION]: {
    label: 'Consultation Call',
    baseCredits: 40,
    defaultRevisions: 0,
    requiredParams: [],
    description: '1-on-1 strategy call',
    pricingText: '40 credits per call',
  },
} as any;

// ─── Credit Packs ────────────────────────────────────────────
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  pricePerCredit: string;
  description: string;
  popular: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [];
