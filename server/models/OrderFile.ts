import { Schema, model, Document, Types } from 'mongoose';

/**
 * 1. THE INTERFACE
 * Tracks files related to an order (briefs, deliverables, revisions).
 */
export interface IOrderFile extends Document {
  order_id: Types.ObjectId;
  uploaded_by: Types.ObjectId;
  file_type: 'brief_upload' | 'deliverable' | 'revision_upload';
  original_name: string;
  storage_url: string;
  mime_type?: string;
  file_size_kb?: number;
  version: number;
  is_approved: boolean;
  approved_at?: Date;
  createdAt: Date;
}

/**
 * 2. THE SCHEMA
 */
const orderFileSchema = new Schema<IOrderFile>(
  {
    order_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Order', 
      required: true,
      index: true 
    },
    uploaded_by: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    file_type: {
      type: String,
      required: true,
      enum: ['brief_upload', 'deliverable', 'revision_upload'],
    },
    original_name: { 
      type: String, 
      required: true 
    },
    storage_url: { 
      type: String, 
      required: true 
    },
    mime_type: String,
    file_size_kb: Number,
    version: { 
      type: Number, 
      default: 1 
    },
    is_approved: { 
      type: Boolean, 
      default: false 
    },
    approved_at: Date,
  },
  {
    // Best Practice: Files are usually immutable (unchanging), 
    // so we only track when they were first uploaded.
    timestamps: { createdAt: true, updatedAt: false }
  }
);

/**
 * 3. COMPOUND INDEX
 * Makes it fast to filter files by type within a specific order.
 */
orderFileSchema.index({ order_id: 1, file_type: 1 });

const OrderFile = model<IOrderFile>('OrderFile', orderFileSchema);

export default OrderFile;
