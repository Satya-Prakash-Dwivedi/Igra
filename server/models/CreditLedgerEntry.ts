import { Schema, model, Document, Types } from 'mongoose';

export enum LedgerReason {
  PACK_PURCHASE = 'PACK_PURCHASE',
  ORDER_CAPTURE = 'ORDER_CAPTURE',
  REFUND        = 'REFUND',
  ADJUSTMENT    = 'ADJUSTMENT',
}

export enum LedgerRefType {
  PAYMENT = 'PAYMENT',
  ORDER   = 'ORDER',
  ADMIN   = 'ADMIN',
}

export interface ICreditLedgerEntry extends Document {
  walletId: Types.ObjectId;
  delta: number;
  reason: LedgerReason;
  refType: LedgerRefType;
  refId: Types.ObjectId;
  idempotencyKey: string;
  hashPrev: string;
  hashSelf: string;
  balanceAfter: number;
  createdAt: Date;
}

const creditLedgerEntrySchema = new Schema<ICreditLedgerEntry>(
  {
    walletId: {
      type: Schema.Types.ObjectId,
      ref: 'CreditWallet',
      required: true,
      index: true,
    },
    delta: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: Object.values(LedgerReason),
    },
    refType: {
      type: String,
      enum: Object.values(LedgerRefType),
    },
    refId: {
      type: Schema.Types.ObjectId,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    hashPrev: {
      type: String,
      default: '',
    },
    hashSelf: {
      type: String,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  {
    // Append-only — no updates
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─── Indexes ──────────────────────────────────────────────────
creditLedgerEntrySchema.index({ walletId: 1, createdAt: 1 });

const CreditLedgerEntry = model<ICreditLedgerEntry>('CreditLedgerEntry', creditLedgerEntrySchema);

export default CreditLedgerEntry;
