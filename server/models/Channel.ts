import { Schema, model, Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────
export type ChannelPace = 'Slow' | 'Normal' | 'Fast' | 'Super';
export type ChannelTone =
    | 'Funny'
    | 'Elegant'
    | 'Serious'
    | 'Casual'
    | 'Professional'
    | 'Informational';

// ─── Interface ────────────────────────────────────────────────
export interface IChannel extends Document {
    id: string;
    userId: Types.ObjectId;
    name: string;
    channelUrl: string;
    logo?: string;
    brandColors: [string, string, string];
    pace: ChannelPace;
    tone: ChannelTone;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────
const channelSchema = new Schema<IChannel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User reference is required'],
            index: true, // Indexed — we always query channels by userId
        },
        name: {
            type: String,
            required: [true, 'Channel name is required'],
            trim: true,
            maxLength: [256, 'Channel name cannot exceed 256 characters'],
        },
        channelUrl: {
            type: String,
            required: [true, 'Channel URL is required'],
            trim: true,
        },
        logo: {
            type: String,
            trim: true,
        },
        brandColors: {
            type: [String],
            validate: {
                validator: (arr: string[]) => arr.length === 3,
                message: 'brandColors must contain exactly 3 hex color strings',
            },
            default: ['#000000', '#ffffff', '#cccccc'],
        },
        pace: {
            type: String,
            enum: {
                values: ['Slow', 'Normal', 'Fast', 'Super'] as ChannelPace[],
                message: '{VALUE} is not a valid pace. Use: Slow, Normal, Fast, Super',
            },
            default: 'Normal',
        },
        tone: {
            type: String,
            enum: {
                values: [
                    'Funny',
                    'Elegant',
                    'Serious',
                    'Casual',
                    'Professional',
                    'Informational',
                ] as ChannelTone[],
                message: '{VALUE} is not a valid tone',
            },
            default: 'Casual',
        },
        description: {
            type: String,
            trim: true,
            maxLength: [2000, 'Description cannot exceed 2000 characters'],
        },
    },
    {
        timestamps: true,
    }
);

const Channel = model<IChannel>('Channel', channelSchema);

export default Channel;
