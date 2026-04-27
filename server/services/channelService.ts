import Channel from '../models/Channel.js';
import type { CreateChannelInput, UpdateChannelInput } from '../validators/channelValidator.js';
import { normalizeAssetUrl } from './uploadService.js';

/**
 * List all channels belonging to a specific user.
 * Always scoped to userId — never returns another user's channels.
 */
export const listChannels = async (userId: string) => {
    const channels = await Channel.find({ userId }).sort({ createdAt: -1 });
    
    // Normalize logos and save back to DB if needed
    for (const channel of channels) {
        if (channel.logo) {
            const normalized = await normalizeAssetUrl(channel.logo);
            if (normalized !== channel.logo) {
                channel.logo = normalized;
                await channel.save();
            }
        }
    }
    
    return channels;
};

/**
 * Create a new channel for a user.
 */
export const createChannel = async (userId: string, data: CreateChannelInput) => {
    return Channel.create({ ...data, userId });
};

/**
 * Get a single channel by ID.
 * Ownership is enforced by filtering on both _id AND userId.
 * If the channel doesn't belong to this user, the result is null → 404.
 */
export const getChannel = async (channelId: string, userId: string) => {
    const channel = await Channel.findOne({ _id: channelId, userId });
    if (!channel) {
        throw Object.assign(new Error('Channel not found'), { statusCode: 404 });
    }

    if (channel.logo) {
        const normalized = await normalizeAssetUrl(channel.logo);
        if (normalized !== channel.logo) {
            channel.logo = normalized;
            await channel.save();
        }
    }

    return channel;
};

/**
 * Update a channel by ID with ownership check.
 * Uses findOneAndUpdate with { new: true } to return the updated document.
 */
export const updateChannel = async (
    channelId: string,
    userId: string,
    data: UpdateChannelInput
) => {
    // Normalize logo in data before saving
    if (data.logo) {
        data.logo = await normalizeAssetUrl(data.logo);
    }

    const channel = await Channel.findOneAndUpdate(
        { _id: channelId, userId },
        { $set: data },
        { returnDocument: 'after', runValidators: true }
    );

    if (!channel) {
        throw Object.assign(new Error('Channel not found'), { statusCode: 404 });
    }
    return channel;
};

/**
 * Delete a channel by ID with ownership check.
 */
export const deleteChannel = async (channelId: string, userId: string) => {
    const channel = await Channel.findOneAndDelete({ _id: channelId, userId });
    if (!channel) {
        throw Object.assign(new Error('Channel not found'), { statusCode: 404 });
    }
    return { id: channelId };
};
