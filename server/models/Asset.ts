import { Schema, model, Document, Types } from 'mongoose';

export interface IAsset extends Document {
  ownerUserId: Types.ObjectId;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string;
  latestVersionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    sizeBytes: {
      type: Number,
      default: 0,
    },
    checksumSha256: String,
    latestVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'AssetVersion',
    },
  },
  { timestamps: true }
);

const Asset = model<IAsset>('Asset', assetSchema);

export default Asset;
