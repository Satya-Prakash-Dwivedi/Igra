import { Schema, model, Document, Types } from 'mongoose';

export enum UploadSessionStatus {
  ACTIVE    = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED   = 'EXPIRED',
}

export interface IUploadedPart {
  partNumber: number;
  etag: string;
  sizeBytes: number;
}

export interface IUploadSession extends Document {
  assetVersionId: Types.ObjectId;
  providerUploadId: string;
  partSizeBytes: number;
  totalParts: number;
  partsUploaded: IUploadedPart[];
  status: UploadSessionStatus;
  expiresAt: Date;
  createdAt: Date;
}

const uploadedPartSchema = new Schema(
  {
    partNumber: { type: Number, required: true },
    etag: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
  },
  { _id: false }
);

const uploadSessionSchema = new Schema<IUploadSession>(
  {
    assetVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'AssetVersion',
      required: true,
      index: true,
    },
    providerUploadId: {
      type: String,
      required: true,
    },
    partSizeBytes: {
      type: Number,
      required: true,
    },
    totalParts: {
      type: Number,
      required: true,
    },
    partsUploaded: {
      type: [uploadedPartSchema],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(UploadSessionStatus),
      default: UploadSessionStatus.ACTIVE,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const UploadSession = model<IUploadSession>('UploadSession', uploadSessionSchema);

export default UploadSession;
