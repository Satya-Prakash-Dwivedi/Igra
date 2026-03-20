import { Schema, model, Document, Types } from 'mongoose';

/**
 * 1. THE INTERFACE
 * Represents a financial transaction within the platform.
 */
export interface IPayment extends Document {
  invoice_id: Types.ObjectId;
  client_id: Types.ObjectId;
  amount: number;
  currency: string;
  payment_method: 'stripe' | 'paypal' | 'bank_transfer' | 'manual';
  gateway_txn_id?: string;
  gateway_status?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  failure_reason?: string;
  paid_at?: Date;
  createdAt: Date;
}

/**
 * 2. THE SCHEMA
 */
const paymentSchema = new Schema<IPayment>(
  {
    invoice_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Invoice', 
      required: true,
      index: true 
    },
    client_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    amount: { 
      type: Number, 
      required: true,
      min: 0 
    },
    currency: { 
      type: String, 
      default: 'USD' 
    },
    payment_method: {
      type: String,
      enum: ['stripe', 'paypal', 'bank_transfer', 'manual']
    },
    gateway_txn_id: { 
      type: String, 
      index: true 
    },
    gateway_status: String,
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      index: true
    },
    failure_reason: String,
    paid_at: Date,
  },
  {
    // Accounting Rule: Financial records are usually permanent history.
    // We only need 'createdAt' to track when the transaction started.
    timestamps: { createdAt: true, updatedAt: false }
  }
);

const Payment = model<IPayment>('Payment', paymentSchema);

export default Payment;
