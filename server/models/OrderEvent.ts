import { Schema, model, Document, Types } from 'mongoose';

export interface IOrderEvent extends Document {
  orderId: Types.ObjectId;
  type: string;
  data: Record<string, any>;
  actorId: Types.ObjectId;
  createdAt: Date;
}

const orderEventSchema = new Schema<IOrderEvent>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    // Append-only: no updates allowed
    timestamps: { createdAt: true, updatedAt: false },
  }
);

orderEventSchema.index({ orderId: 1, createdAt: 1 });

const OrderEvent = model<IOrderEvent>('OrderEvent', orderEventSchema);

export default OrderEvent;
