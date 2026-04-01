import { Ticket, BugReport } from '../models/SupportRequest.ts';
import type { CreateTicketInput, CreateBugReportInput } from '../validators/supportValidator.ts';

/**
 * Create a new support ticket for a user.
 * Uses the Ticket discriminator — stored in `support_requests` with __t: 'Ticket'.
 */
export const createTicket = async (userId: string, data: CreateTicketInput) => {
    return Ticket.create({ ...data, userId });
};

/**
 * Create a new bug report for a user.
 * Uses the BugReport discriminator — stored in `support_requests` with __t: 'BugReport'.
 */
export const createBugReport = async (userId: string, data: CreateBugReportInput) => {
    return BugReport.create({ ...data, userId });
};
