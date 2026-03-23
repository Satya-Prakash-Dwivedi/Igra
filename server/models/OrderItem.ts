import { Schema, model, Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────
export enum OrderItemKind {
  VIDEO_EDIT       = 'VIDEO_EDIT',
  THUMBNAIL        = 'THUMBNAIL',
  INTRO            = 'INTRO',
  OUTRO            = 'OUTRO',
  VOICEOVER        = 'VOICEOVER',
  SCRIPT           = 'SCRIPT',
  SEO              = 'SEO',
  CHANNEL_BANNER   = 'CHANNEL_BANNER',
  LOGO_DESIGN      = 'LOGO_DESIGN',
  IMAGE_RETOUCHING = 'IMAGE_RETOUCHING',
  CONSULTATION     = 'CONSULTATION',
  FOOTAGE_REVIEW   = 'FOOTAGE_REVIEW',
  CUSTOM           = 'CUSTOM',
}

export enum OrderItemStatus {
  PENDING_INPUT = 'PENDING_INPUT',
  BLOCKED       = 'BLOCKED',
  READY         = 'READY',
  IN_PROGRESS   = 'IN_PROGRESS',
  DELIVERED     = 'DELIVERED',
  APPROVED      = 'APPROVED',
  FAILED        = 'FAILED',
  CANCELLED     = 'CANCELLED',
}

// Valid item transitions — admin drives all post-submission transitions
export const ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  [OrderItemStatus.PENDING_INPUT]: [OrderItemStatus.READY, OrderItemStatus.BLOCKED, OrderItemStatus.CANCELLED],
  [OrderItemStatus.BLOCKED]:       [OrderItemStatus.READY, OrderItemStatus.CANCELLED],
  [OrderItemStatus.READY]:         [OrderItemStatus.IN_PROGRESS, OrderItemStatus.CANCELLED],
  [OrderItemStatus.IN_PROGRESS]:   [OrderItemStatus.DELIVERED, OrderItemStatus.FAILED, OrderItemStatus.CANCELLED],
  [OrderItemStatus.DELIVERED]:     [OrderItemStatus.APPROVED, OrderItemStatus.IN_PROGRESS], // IN_PROGRESS = revision
  [OrderItemStatus.APPROVED]:      [],
  [OrderItemStatus.FAILED]:        [],
  [OrderItemStatus.CANCELLED]:     [],
};

// ─── Sub-document: Pricing Snapshot ───────────────────────────
export interface IPricingModifier {
  label: string;
  delta: number;
}

export interface IPricingSnapshot {
  priceVersion: string;
  inputs: Record<string, any>;
  base: number;
  modifiers: IPricingModifier[];
  totalCredits: number;
}

// ─── Interface ────────────────────────────────────────────────
export interface IOrderItem extends Document {
  orderId: Types.ObjectId;
  kind: OrderItemKind;
  params: Record<string, any>;
  schemaVersion: number;
  pricingSnapshot: IPricingSnapshot;
  creditsQuoted: number;
  status: OrderItemStatus;
  allowedRevisions: number;
  usedRevisions: number;
  dependsOnItemIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────
const pricingModifierSchema = new Schema(
  {
    label: { type: String, required: true },
    delta: { type: Number, required: true },
  },
  { _id: false }
);

const pricingSnapshotSchema = new Schema(
  {
    priceVersion: { type: String, default: 'v1' },
    inputs: { type: Schema.Types.Mixed, default: {} },
    base: { type: Number, required: true },
    modifiers: { type: [pricingModifierSchema], default: [] },
    totalCredits: { type: Number, required: true },
  },
  { _id: false }
);

const orderItemSchema = new Schema<IOrderItem>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      required: true,
      enum: Object.values(OrderItemKind),
    },
    params: {
      type: Schema.Types.Mixed,
      default: {},
    },
    schemaVersion: {
      type: Number,
      default: 1,
    },
    pricingSnapshot: {
      type: pricingSnapshotSchema,
      required: true,
    },
    creditsQuoted: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(OrderItemStatus),
      default: OrderItemStatus.PENDING_INPUT,
      index: true,
    },
    allowedRevisions: {
      type: Number,
      default: 2,
    },
    usedRevisions: {
      type: Number,
      default: 0,
    },
    dependsOnItemIds: [
      { type: Schema.Types.ObjectId, ref: 'OrderItem' },
    ],
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────
orderItemSchema.index({ orderId: 1, status: 1 });

const OrderItem = model<IOrderItem>('OrderItem', orderItemSchema);

export default OrderItem;
