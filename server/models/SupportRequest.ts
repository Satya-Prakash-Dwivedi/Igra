/**
 * SupportRequest — Base model + two discriminators: Ticket & BugReport
 *
 * Both document types live in the same `support_requests` collection.
 * Mongoose adds a `__t` field internally to route queries to the right sub-model.
 * This keeps collection count low while keeping the schemas cleanly separated.
 */
import { Schema, model, Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────
export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type TicketCategory =
    | 'Order Problem'
    | 'Billing Issue'
    | 'Technical Issue'
    | 'Feature Request'
    | 'Other';

// ─── Base Interface ───────────────────────────────────────────
export interface ISupportRequest extends Document {
    id: string;
    userId: Types.ObjectId;
    status: SupportStatus;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Discriminator Interfaces ─────────────────────────────────
export interface ITicket extends ISupportRequest {
    category: TicketCategory;
    message: string;
    attachmentAssetIds: string[];
}

export interface IBugReport extends ISupportRequest {
    description: string;
    screenshotAssetIds: string[];
    wantsFollowUp: boolean;
}

// ─── Base Schema ──────────────────────────────────────────────
const supportRequestSchema = new Schema<ISupportRequest>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User reference is required'],
            index: true,
        },
        status: {
            type: String,
            enum: ['open', 'in_progress', 'resolved', 'closed'] as SupportStatus[],
            default: 'open',
            index: true,
        },
    },
    {
        timestamps: true,
        // The discriminator key is stored in the `__t` field by Mongoose automatically.
        // We declare it here to make it explicit and queryable.
        discriminatorKey: '__t',
    }
);

// ─── Base Model ───────────────────────────────────────────────
export const SupportRequest = model<ISupportRequest>('SupportRequest', supportRequestSchema);

// ─── Ticket Discriminator ─────────────────────────────────────
const ticketSchema = new Schema<ITicket>({
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: {
            values: [
                'Order Problem',
                'Billing Issue',
                'Technical Issue',
                'Feature Request',
                'Other',
            ] as TicketCategory[],
            message: '{VALUE} is not a valid category',
        },
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxLength: [5000, 'Message cannot exceed 5000 characters'],
    },
    attachmentAssetIds: {
        type: [String],
        default: [],
    },
});

export const Ticket = SupportRequest.discriminator<ITicket>('Ticket', ticketSchema);

// ─── BugReport Discriminator ──────────────────────────────────
const bugReportSchema = new Schema<IBugReport>({
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minLength: [10, 'Description must be at least 10 characters'],
        maxLength: [5000, 'Description cannot exceed 5000 characters'],
    },
    screenshotAssetIds: {
        type: [String],
        default: [],
    },
    wantsFollowUp: {
        type: Boolean,
        default: false,
    },
});

export const BugReport = SupportRequest.discriminator<IBugReport>('BugReport', bugReportSchema);
