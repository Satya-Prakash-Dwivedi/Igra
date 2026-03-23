import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import asyncHandler from 'express-async-handler';
import Message from '../models/Message.ts';

// ─── Get Messages for Order ───────────────────────────────────
export const getMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = req.params.id as string;
  const page = Number(req.query.page || '1');
  const limit = Number(req.query.limit || '50');
  const messages = await Message.find({ orderId })
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('senderId', 'name email avatar role')
    .lean();
  const total = await Message.countDocuments({ orderId });
  res.json({ success: true, data: { messages, total, page, limit } });
});

// ─── Send Message ─────────────────────────────────────────────
export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orderId = req.params.id as string;
  const { content, itemId, attachmentAssetIds } = req.body;
  const user = req.user!;
  const message = await Message.create({
    orderId,
    senderId: user._id,
    senderRole: user.role === 'user' ? 'client' : user.role,
    content,
    itemId,
    attachmentAssetIds: attachmentAssetIds || [],
  });

  const populated = await Message.findById(message._id)
    .populate('senderId', 'name email avatar role')
    .lean();

  // Emit via Socket.IO for real-time delivery
  const io = req.app.get('io');
  if (io) {
    io.to(`order:${orderId}`).emit('new-message', populated);
  }

  res.status(201).json({ success: true, data: populated });
});
