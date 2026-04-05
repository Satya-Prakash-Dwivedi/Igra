import { Ticket, BugReport, SupportRequest, type SupportStatus } from '../models/SupportRequest.ts';
import type { CreateTicketInput, CreateBugReportInput } from '../validators/supportValidator.ts';

/**
 * Create a new support ticket for a user.
 */
export const createTicket = async (userId: string, data: CreateTicketInput) => {
    return Ticket.create({ ...data, userId });
};

/**
 * Create a new bug report for a user.
 */
export const createBugReport = async (userId: string, data: CreateBugReportInput) => {
    return BugReport.create({ ...data, userId });
};

// ─── Admin Methods ────────────────────────────────────────────

/**
 * List all tickets (admin view), paginated, newest first.
 */
export const listTickets = async (page = 1, limit = 20) => {
    const [tickets, total] = await Promise.all([
        Ticket.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'name email')
            .lean(),
        Ticket.countDocuments(),
    ]);
    return { tickets, total, page, pages: Math.ceil(total / limit) };
};

/**
 * List all bug reports (admin view), paginated, newest first.
 */
export const listBugReports = async (page = 1, limit = 20) => {
    const [bugReports, total] = await Promise.all([
        BugReport.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'name email')
            .lean(),
        BugReport.countDocuments(),
    ]);
    return { bugReports, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Update the status of any support request document (works for both Ticket and BugReport).
 * Uses the base model so we only need one DB call regardless of type.
 */
export const updateSupportStatus = async (id: string, status: SupportStatus) => {
    const doc = await SupportRequest.findByIdAndUpdate(
        id,
        { status },
        { returnDocument: 'after', runValidators: true }
    ).lean();
    if (!doc) {
        throw Object.assign(new Error('Support request not found'), { statusCode: 404 });
    }
    return doc;
};

