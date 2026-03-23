import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  orderId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: 'client' | 'admin' | 'staff';
  content: string;
  itemId?: Types.ObjectId;
  attachmentAssetIds: Types.ObjectId[];
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
      enum: ['client', 'admin', 'staff'],
    },
    content: {
      type: String,
      required: [true, 'Message content cannot be empty'],
      trim: true,
    },
    // Optional: anchor message to a specific OrderItem for context
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'OrderItem',
    },
    attachmentAssetIds: [
      { type: Schema.Types.ObjectId, ref: 'Asset' },
    ],
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

messageSchema.index({ orderId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, isRead: 1 });

const Message = model<IMessage>('Message', messageSchema);

export default Message;
