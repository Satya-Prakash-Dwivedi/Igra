import Channel from '../models/Channel.ts';
import type { CreateChannelInput, UpdateChannelInput } from '../validators/channelValidator.ts';

/**
 * List all channels belonging to a specific user.
 * Always scoped to userId — never returns another user's channels.
 */
export const listChannels = async (userId: string) => {
    return Channel.find({ userId }).lean().sort({ createdAt: -1 });
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
    const channel = await Channel.findOne({ _id: channelId, userId }).lean();
    if (!channel) {
        throw Object.assign(new Error('Channel not found'), { statusCode: 404 });
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
    const channel = await Channel.findOneAndUpdate(
        { _id: channelId, userId },   // ownership check baked into the query
        { $set: data },
        { returnDocument: 'after', runValidators: true }
    ).lean();

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
