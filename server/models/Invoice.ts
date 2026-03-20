import { Schema, model, Document, Types } from 'mongoose';

/**
 * 1. THE INTERFACE
 * Represents a formal billing document for a specific order.
 */
export interface IInvoice extends Document {
  invoiceNumber: string;
  order_id: Types.ObjectId;
  client_id: Types.ObjectId;
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  due_date?: Date;
  paid_at?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 2. THE SCHEMA
 */
const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      index: true 
    },
    // Enforces 1 invoice per order (Unique relationship)
    order_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Order', 
      required: true, 
      unique: true 
    },
    client_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    subtotal: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    discount: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    tax_rate: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    tax_amount: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    total_amount: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    currency: { 
      type: String, 
      default: 'USD' 
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
      index: true
    },
    due_date: { 
      type: Date, 
      index: true 
    },
    paid_at: Date,
    notes: String,
  },
  {
    timestamps: true 
  }
);

/**
 * 3. INDEXES
 * (client_id, status) -> Fast lookup for client billing history.
 * (due_date) -> Fast lookup for overdue tracking.
 */
invoiceSchema.index({ client_id: 1, status: 1 });

const Invoice = model<IInvoice>('Invoice', invoiceSchema);

export default Invoice;
