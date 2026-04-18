import { Schema, model, Document, Types } from 'mongoose';

export interface ICreditWallet extends Document {
  userId: Types.ObjectId;
  currency: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const creditWalletSchema = new Schema<ICreditWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    currency: {
      type: String,
      default: 'CREDITS',
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const CreditWallet = model<ICreditWallet>('CreditWallet', creditWalletSchema);

export default CreditWallet;
