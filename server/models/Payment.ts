import { Schema, model, Document, Types } from 'mongoose';

// ─── Payment for credit purchases via PayPal ──────────────────
export enum PaymentStatus {
  CREATED  = 'CREATED',
  APPROVED = 'APPROVED',
  CAPTURED = 'CAPTURED',
  FAILED   = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface IPayment extends Document {
  userId: Types.ObjectId;
  provider: string;
  paypalOrderId: string;
  paypalCaptureId?: string;
  amountCents: number;
  currency: string;
  creditsPurchased: number;
  packId: string;
  status: PaymentStatus;
  idempotencyKey: string;
  failureReason?: string;
  capturedAt?: Date;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      default: 'paypal',
    },
    paypalOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paypalCaptureId: String,
    amountCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    creditsPurchased: {
      type: Number,
      required: true,
      min: 0,
    },
    packId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.CREATED,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    failureReason: String,
    capturedAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const Payment = model<IPayment>('Payment', paymentSchema);

export default Payment;
