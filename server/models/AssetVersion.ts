import { Schema, model, Document, Types } from 'mongoose';

export enum AssetVersionStatus {
  UPLOADING = 'UPLOADING',
  SEALED    = 'SEALED',
  READY     = 'READY',
}

export interface IAssetVersion extends Document {
  assetId: Types.ObjectId;
  storageKey: string;
  sizeBytes: number;
  status: AssetVersionStatus;
  versionNumber: number;
  createdAt: Date;
}

const assetVersionSchema = new Schema<IAssetVersion>(
  {
    assetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      index: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(AssetVersionStatus),
      default: AssetVersionStatus.UPLOADING,
    },
    versionNumber: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

assetVersionSchema.index({ assetId: 1, versionNumber: 1 });

const AssetVersion = model<IAssetVersion>('AssetVersion', assetVersionSchema);

export default AssetVersion;
