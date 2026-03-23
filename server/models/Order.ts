import { Schema, model, Document, Types } from 'mongoose';

// ─── Order Statuses ───────────────────────────────────────────
export enum OrderStatus {
  DRAFT              = 'DRAFT',
  PENDING_PAYMENT    = 'PENDING_PAYMENT',
  UNDER_REVIEW       = 'UNDER_REVIEW',
  IN_PROGRESS        = 'IN_PROGRESS',
  FINALIZING         = 'FINALIZING',
  AWAITING_APPROVAL  = 'AWAITING_APPROVAL',
  COMPLETED          = 'COMPLETED',
  CANCELLED          = 'CANCELLED',
}

// Valid transitions — admin controls all post-submission transitions
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]:             [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
  [OrderStatus.PENDING_PAYMENT]:   [OrderStatus.UNDER_REVIEW, OrderStatus.CANCELLED],
  [OrderStatus.UNDER_REVIEW]:      [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
  [OrderStatus.IN_PROGRESS]:       [OrderStatus.FINALIZING, OrderStatus.CANCELLED],
  [OrderStatus.FINALIZING]:        [OrderStatus.AWAITING_APPROVAL, OrderStatus.IN_PROGRESS],
  [OrderStatus.AWAITING_APPROVAL]: [OrderStatus.COMPLETED, OrderStatus.IN_PROGRESS],
  [OrderStatus.COMPLETED]:         [],
  [OrderStatus.CANCELLED]:         [],
};

// ─── Interface ────────────────────────────────────────────────
export interface IOrder extends Document {
  orderNumber: string;
  userId: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  status: OrderStatus;
  idempotencyKey: string;
  title: string;
  totalCreditsQuoted: number;
  totalCreditsCaptured: number;
  submittedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────
const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(OrderStatus),
      default: OrderStatus.DRAFT,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    totalCreditsQuoted: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCreditsCaptured: {
      type: Number,
      default: 0,
      min: 0,
    },
    submittedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ assignedTo: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

const Order = model<IOrder>('Order', orderSchema);

export default Order;
