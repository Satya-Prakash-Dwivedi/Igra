import { Schema, model, Document } from 'mongoose';

/**
 * 1. THE INTERFACE
 * Defines the shape of a Service document in TypeScript.
 */
export interface IService extends Document {
  name: string;
  slug: string;
  description?: string;
  basePrice: number;
  pricingType: 'fixed' | 'custom';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema for Services Model
 */
const serviceSchema = new Schema<IService>(
  {
    name: { 
      type: String, 
      required: [true, 'Service name is required'], 
      trim: true 
    },
    slug: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      index: true 
    },
    description: { 
      type: String 
    },
    basePrice: { 
      type: Number, 
      required: true,
      min: [0, 'Price cannot be negative']
    },
    pricingType: { 
      type: String, 
      required: true,
      enum: ['fixed', 'custom']
    },
    isActive: { 
      type: Boolean, 
      default: true,
      index: true 
    }
  },
  {
    timestamps: true 
  }
);

const Service = model<IService>('Service', serviceSchema);

export default Service;
