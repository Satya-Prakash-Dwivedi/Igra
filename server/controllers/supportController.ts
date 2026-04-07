import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import * as supportService from '../services/supportService.js';
import { createTicketSchema, createBugReportSchema } from '../validators/supportValidator.js';

// ─── POST /api/v1/support/tickets ─────────────────────────────
export const createTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
    const validatedData = createTicketSchema.parse(req.body);

    const ticket = await supportService.createTicket(
        req.user!._id.toString(),
        validatedData
    );

    res.status(201).json({
        success: true,
        data: {
            ticket: {
                _id: ticket._id,
                status: ticket.status,
                category: ticket.category,
                message: ticket.message,
                attachmentAssetIds: ticket.attachmentAssetIds,
                createdAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
            },
        },
        message: 'Support ticket created successfully',
    });
});

// ─── POST /api/v1/support/bugs ────────────────────────────────
export const createBugReport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const validatedData = createBugReportSchema.parse(req.body);

    const bugReport = await supportService.createBugReport(
        req.user!._id.toString(),
        validatedData
    );

    res.status(201).json({
        success: true,
        data: {
            bugReport: {
                _id: bugReport._id,
                status: bugReport.status,
                description: bugReport.description,
                screenshotAssetIds: bugReport.screenshotAssetIds,
                wantsFollowUp: bugReport.wantsFollowUp,
                createdAt: bugReport.createdAt,
                updatedAt: bugReport.updatedAt,
            },
        },
        message: 'Bug report submitted successfully',
    });
});
