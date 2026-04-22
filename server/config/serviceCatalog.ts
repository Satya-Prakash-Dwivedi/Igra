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
    label: 'Video',
    baseCredits: 0, // Computed dynamically (20 per min)
    perMinuteCredits: 20,
    defaultRevisions: 2,
    requiredParams: ['rawFootageLength', 'desiredLength', 'outputRatio'],
    description: 'Professional video editing',
    pricingText: '20 credits per minute of raw footage',
  },
  [OrderItemKind.THUMBNAIL]: {
    label: 'Thumbnail Design',
    baseCredits: 50,
    defaultRevisions: 3,
    requiredParams: ['style'],
    description: 'Eye-catching thumbnail design',
    pricingText: '50 credits per thumbnail',
  },
  [OrderItemKind.INTRO]: {
    label: 'Custom Intro',
    baseCredits: 100,
    defaultRevisions: 2,
    requiredParams: [],
    description: 'Custom animated intro for your channel',
    pricingText: '100 credits',
  },
  [OrderItemKind.OUTRO]: {
    label: 'Custom Outro',
    baseCredits: 100,
    defaultRevisions: 2,
    requiredParams: [],
    description: 'Custom animated outro for your channel',
    pricingText: '100 credits',
  },
  [OrderItemKind.VOICEOVER]: {
    label: 'AI Voiceover',
    baseCredits: 50,
    perMinuteCredits: 10,
    defaultRevisions: 2,
    requiredParams: ['scriptLength'],
    description: 'AI-generated voiceover narration',
    pricingText: '10 credits per minute (min. 50 credits)',
  },
  [OrderItemKind.SCRIPT]: {
    label: 'Script Writing',
    baseCredits: 100,
    defaultRevisions: 2,
    requiredParams: ['wordCount'],
    description: 'Professional script writing',
    pricingText: '100 credits per 500 words',
  },
  [OrderItemKind.SEO]: {
    label: 'Video SEO',
    baseCredits: 100,
    defaultRevisions: 1,
    requiredParams: ['videoUrl'],
    description: 'SEO optimization for your video',
    pricingText: '100 credits per video',
  },
  [OrderItemKind.CHANNEL_BANNER]: {
    label: 'Channel Banner',
    baseCredits: 150,
    defaultRevisions: 2,
    requiredParams: [],
    description: 'Professional channel banner design',
    pricingText: '150 credits',
  },
  [OrderItemKind.LOGO_DESIGN]: {
    label: 'Logo Design',
    baseCredits: 100,
    defaultRevisions: 2,
    requiredParams: [],
    description: 'Professional logo design',
    pricingText: '100 credits',
  },
  [OrderItemKind.IMAGE_RETOUCHING]: {
    label: 'Image Retouching',
    baseCredits: 100,
    defaultRevisions: 2,
    requiredParams: [],
    description: 'Professional image retouching',
    pricingText: '100 credits',
  },
  [OrderItemKind.CONSULTATION]: {
    label: 'Consultation Call',
    baseCredits: 100,
    defaultRevisions: 0,
    requiredParams: [],
    description: '1-on-1 strategy call',
    pricingText: '100 credits per 15 minutes',
  },
  [OrderItemKind.FOOTAGE_REVIEW]: {
    label: 'Footage Review',
    baseCredits: 50,
    perMinuteCredits: 10,
    defaultRevisions: 0,
    requiredParams: ['footageLength'],
    description: 'Professional review of your raw footage',
    pricingText: '10 credits per minute (min. 50 credits)',
  },
  [OrderItemKind.CUSTOM]: {
    label: 'Custom Request',
    baseCredits: 0,
    defaultRevisions: 2,
    requiredParams: ['description'],
    description: 'Let us know what you need',
    pricingText: 'Priced after review',
  },
};

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

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 500,
    priceCents: 45000,
    pricePerCredit: '$0.90',
    description: 'Ideal for small creators just starting out.',
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    credits: 1000,
    priceCents: 80000,
    pricePerCredit: '$0.80',
    description: 'Best for growing channels with consistent output.',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    credits: 2500,
    priceCents: 190000,
    pricePerCredit: '$0.76',
    description: 'For power users and media agencies.',
    popular: false,
  },
];
