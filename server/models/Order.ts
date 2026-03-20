import { Schema, model, Document, Types } from 'mongoose';

/**
 * 1. THE INTERFACE
 * Defines the structure of an Order, including links (refs) to other models.
 */
export interface IOrder extends Document {
  orderNumber: string;
  client_id: Types.ObjectId;
  assigned_to?: Types.ObjectId;
  service_id: Types.ObjectId;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'review' | 'revision_requested' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  priceSnapshot: number;
  currency: string;
  revision_count: number;
  max_revisions: number;
  deadline_at?: Date;
  started_at?: Date;
  delivered_at?: Date;
  completed_at?: Date;
  internal_notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 2. THE SCHEMA
 * Note how we use 'ref' to connect to the 'User' and 'Service' models.
 */
const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      index: true 
    },
    client_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    assigned_to: { 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    },
    service_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Service', 
      required: true 
    },
    title: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: String,
    status: {
      type: String,
      required: true,
      enum: ['pending', 'in_progress', 'review', 'revision_requested', 'completed', 'cancelled'],
      default: 'pending',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    priceSnapshot: { 
      type: Number, 
      required: true 
    },
    currency: { 
      type: String, 
      default: 'USD' 
    },
    revision_count: { 
      type: Number, 
      default: 0 
    },
    max_revisions: { 
      type: Number, 
      default: 3 
    },
    deadline_at: Date,
    started_at: Date,
    delivered_at: Date,
    completed_at: Date,
    internal_notes: String,
  },
  {
    // Automatically manages 'createdAt' and 'updatedAt'
    timestamps: true 
  }
);

/**
 * 3. COMPOUND INDEXES
 * Great for queries like "Find all 'completed' orders for this 'client_id'"
 */
orderSchema.index({ client_id: 1, status: 1 });
orderSchema.index({ assigned_to: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

const Order = model<IOrder>('Order', orderSchema);

export default Order;
