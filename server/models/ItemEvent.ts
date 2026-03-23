import { Schema, model, Document, Types } from 'mongoose';

export interface IItemEvent extends Document {
  orderItemId: Types.ObjectId;
  type: string;
  data: Record<string, any>;
  actorId: Types.ObjectId;
  createdAt: Date;
}

const itemEventSchema = new Schema<IItemEvent>(
  {
    orderItemId: {
      type: Schema.Types.ObjectId,
      ref: 'OrderItem',
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
    timestamps: { createdAt: true, updatedAt: false },
  }
);

itemEventSchema.index({ orderItemId: 1, createdAt: 1 });

const ItemEvent = model<IItemEvent>('ItemEvent', itemEventSchema);

export default ItemEvent;
