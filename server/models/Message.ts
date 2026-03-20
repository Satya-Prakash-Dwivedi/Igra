import { Schema, model, Document, Types } from 'mongoose';

/**
 * 1. THE INTERFACE
 * Represents a single message in an order's communication thread.
 */
export interface IMessage extends Document {
  order_id: Types.ObjectId;
  sender_id: Types.ObjectId;
  sender_role: 'client' | 'admin' | 'staff';
  content: string;
  is_read: boolean;
  read_at?: Date;
  createdAt: Date;
}

/**
 * 2. THE SCHEMA
 */
const messageSchema = new Schema<IMessage>(
  {
    order_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Order', 
      required: true 
    },
    sender_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    sender_role: {
      type: String,
      required: true,
      enum: ['client', 'admin', 'staff'],
    },
    content: { 
      type: String, 
      required: [true, 'Message content cannot be empty'],
      trim: true 
    },
    is_read: { 
      type: Boolean, 
      default: false 
    },
    read_at: Date,
  },
  {
    // Best Practice: Messages are permanent history. 
    // We only need 'createdAt' to order the conversation correctly.
    timestamps: { createdAt: true, updatedAt: false }
  }
);

/**
 * 3. INDEXES
 * (order_id, createdAt) -> Fast loading of chat history in time order.
 * (sender_id, is_read) -> Fast check for unread notifications.
 */
messageSchema.index({ order_id: 1, createdAt: 1 });
messageSchema.index({ sender_id: 1, is_read: 1 });

const Message = model<IMessage>('Message', messageSchema);

export default Message;
