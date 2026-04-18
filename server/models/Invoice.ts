import { Schema, model, Document, Types } from 'mongoose';

// ─── Invoice — one per credit purchase ────────────────────────
export interface IInvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface IInvoice extends Document {
  userId: Types.ObjectId;
  paymentId: Types.ObjectId;
  invoiceNumber: string;
  lineItems: IInvoiceLineItem[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
  pdfStorageKey?: string;
  createdAt: Date;
}

const invoiceLineItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true },
    totalCents: { type: Number, required: true },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      unique: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    lineItems: {
      type: [invoiceLineItemSchema],
      required: true,
    },
    subtotalCents: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    pdfStorageKey: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

invoiceSchema.index({ userId: 1, createdAt: -1 });

const Invoice = model<IInvoice>('Invoice', invoiceSchema);

export default Invoice;
