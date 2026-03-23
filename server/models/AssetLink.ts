import { Schema, model, Document, Types } from 'mongoose';

export enum AssetRole {
  INPUT  = 'INPUT',
  OUTPUT = 'OUTPUT',
}

export interface IAssetLink extends Document {
  orderItemId: Types.ObjectId;
  assetId: Types.ObjectId;
  role: AssetRole;
  orderIndex?: number;
  createdAt: Date;
}

const assetLinkSchema = new Schema<IAssetLink>(
  {
    orderItemId: {
      type: Schema.Types.ObjectId,
      ref: 'OrderItem',
      required: true,
      index: true,
    },
    assetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(AssetRole),
    },
    orderIndex: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

assetLinkSchema.index({ orderItemId: 1, role: 1 });

const AssetLink = model<IAssetLink>('AssetLink', assetLinkSchema);

export default AssetLink;
