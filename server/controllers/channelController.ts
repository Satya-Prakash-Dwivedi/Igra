import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import asyncHandler from 'express-async-handler';
import * as channelService from '../services/channelService.ts';
import { createChannelSchema, updateChannelSchema } from '../validators/channelValidator.ts';

// ─── List Channels ────────────────────────────────────────────
export const listChannels = asyncHandler(async (req: AuthRequest, res: Response) => {
    const channels = await channelService.listChannels(req.user!._id.toString());

    res.json({
        success: true,
        data: { channels },
    });
});

// ─── Create Channel ───────────────────────────────────────────
export const createChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
    // Validate — throw 400 on bad data (caught by global error handler)
    const validatedData = createChannelSchema.parse(req.body);

    const channel = await channelService.createChannel(
        req.user!._id.toString(),
        validatedData
    );

    res.status(201).json({
        success: true,
        data: { channel },
        message: 'Channel created successfully',
    });
});

// ─── Get Channel ──────────────────────────────────────────────
export const getChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
    const channel = await channelService.getChannel(
        req.params.id as string,
        req.user!._id.toString()
    );

    res.json({
        success: true,
        data: { channel },
    });
});

// ─── Update Channel ───────────────────────────────────────────
export const updateChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
    const validatedData = updateChannelSchema.parse(req.body);

    const channel = await channelService.updateChannel(
        req.params.id as string,
        req.user!._id.toString(),
        validatedData
    );

    res.json({
        success: true,
        data: { channel },
        message: 'Channel updated successfully',
    });
});

// ─── Delete Channel ───────────────────────────────────────────
export const deleteChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
    await channelService.deleteChannel(
        req.params.id as string,
        req.user!._id.toString()
    );

    res.json({
        success: true,
        data: null,
        message: 'Channel deleted successfully',
    });
});
