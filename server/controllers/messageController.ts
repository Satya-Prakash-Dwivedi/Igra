import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Order from '../models/Order.js';
import { normalizeAssetUrl } from '../services/uploadService.js';

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

  if (populated && populated.senderId && typeof populated.senderId === 'object') {
    (populated.senderId as any).avatar = await normalizeAssetUrl((populated.senderId as any).avatar);
  }

  // Emit via Socket.IO for real-time delivery
  const io = req.app.get('io');
  if (io) {
    io.to(`order:${orderId}`).emit('new-message', populated);
  }

  // Create notification for recipients
  if (user.role === 'user') {
    // Client sent message -> Notify admins or assigned staff
    const order = await Order.findById(orderId).lean();
    if (order) {
      const recipientId = order.assignedTo || (await (await import('../models/User.js')).default.findOne({ role: 'admin' }).select('_id').lean())?._id;
      if (recipientId) {
        const notif = await Notification.create({
          recipientId,
          senderId: user._id,
          type: 'MESSAGE',
          content: `New message on Order #${order.orderNumber}`,
          orderId,
          messageId: message._id,
        });
        if (io) {
          const populatedNotif = await Notification.findById(notif._id).populate('senderId', 'name avatar').lean();
          io.to(`user:${recipientId}`).emit('new-notification', populatedNotif);
        }
      }
    }
  } else {
    // Admin/Staff sent message -> Notify client
    const order = await Order.findById(orderId).lean();
    if (order) {
      const notif = await Notification.create({
        recipientId: order.userId,
        senderId: user._id,
        type: 'MESSAGE',
        content: `New message on Order #${order.orderNumber}`,
        orderId,
        messageId: message._id,
      });
      if (io) {
        const populatedNotif = await Notification.findById(notif._id).populate('senderId', 'name avatar').lean();
        io.to(`user:${order.userId}`).emit('new-notification', populatedNotif);
      }
    }
  }

  res.status(201).json({ success: true, data: populated });
});

// ─── Direct Messaging ─────────────────────────────────────────

// Get User's DMs (Client Side)
export const getDirectMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!._id;
  const page = Number(req.query.page || '1');
  const limit = Number(req.query.limit || '50');
  const messages = await Message.find({ isDirectMessage: true, userId })
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('senderId', 'name email avatar role')
    .lean();

  // Normalize avatars
  for (const msg of messages) {
    if (msg.senderId && typeof msg.senderId === 'object' && (msg.senderId as any).avatar) {
      (msg.senderId as any).avatar = await normalizeAssetUrl((msg.senderId as any).avatar);
    }
  }

  const total = await Message.countDocuments({ isDirectMessage: true, userId });
  res.json({ success: true, data: { messages, total, page, limit } });
});

// Send DM (Client Side)
export const sendDirectMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!._id;
  const { content, attachmentAssetIds } = req.body;
  const message = await Message.create({
    isDirectMessage: true,
    userId,
    senderId: userId,
    senderRole: 'client',
    content,
    attachmentAssetIds: attachmentAssetIds || [],
  });
  
  const populated = await Message.findById(message._id)
    .populate('senderId', 'name email avatar role')
    .lean();

  if (populated && populated.senderId && typeof populated.senderId === 'object') {
    (populated.senderId as any).avatar = await normalizeAssetUrl((populated.senderId as any).avatar);
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`dm:${userId}`).emit('new-dm', populated);
  }

  // Notify admins (since it's a DM to the studio)
  const User = (await import('../models/User.js')).default;
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  for (const admin of admins) {
    const notif = await Notification.create({
      recipientId: admin._id,
      senderId: userId,
      type: 'MESSAGE',
      content: `New DM from ${req.user!.name}`,
      messageId: message._id,
    });
    if (io) {
      const populatedNotif = await Notification.findById(notif._id).populate('senderId', 'name avatar').lean();
      io.to(`user:${admin._id}`).emit('new-notification', populatedNotif);
    }
  }

  res.status(201).json({ success: true, data: populated });
});

// Admin: Get DM Threads (List of users who messaged)
export const listDirectMessageThreads = asyncHandler(async (req: AuthRequest, res: Response) => {
  const threads = await Message.aggregate([
    { $match: { isDirectMessage: true } },
    { $sort: { createdAt: -1 } },
    { $group: {
        _id: '$userId',
        latestMessage: { $first: '$$ROOT' },
        unreadCount: { 
          $sum: { $cond: [{ $and: [{ $eq: ['$isRead', false] }, { $eq: ['$senderRole', 'client'] }] }, 1, 0] }
        }
    }},
    { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
    }},
    { $unwind: '$user' },
    { $sort: { 'latestMessage.createdAt': -1 } }
  ]);
  
  const formatted = threads.map(t => ({
     userId: t._id,
     user: { _id: t.user._id, name: t.user.name, email: t.user.email, avatar: t.user.avatar },
     latestMessage: t.latestMessage,
     unreadCount: t.unreadCount
  }));
  
  res.json({ success: true, data: formatted });
});

// Admin: Get specific user's DM thread
export const getDirectMessagesForUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const targetUserId = req.params.userId;
  const page = Number(req.query.page || '1');
  const limit = Number(req.query.limit || '50');
  
  await Message.updateMany(
    { isDirectMessage: true, userId: targetUserId, senderRole: 'client', isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  const messages = await Message.find({ isDirectMessage: true, userId: targetUserId })
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('senderId', 'name email avatar role')
    .lean();
  const total = await Message.countDocuments({ isDirectMessage: true, userId: targetUserId });
  
  res.json({ success: true, data: { messages, total, page, limit } });
});

// Admin: Reply to user's DM
export const replyDirectMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const targetUserId = req.params.userId as string;
  const adminId = req.user!._id;
  const adminRole = req.user!.role as 'admin' | 'staff';
  const { content, attachmentAssetIds } = req.body;
  
  const message = await Message.create({
    isDirectMessage: true,
    userId: targetUserId,
    senderId: adminId,
    senderRole: adminRole,
    content,
    attachmentAssetIds: attachmentAssetIds || [],
  });
  
  const populated = await Message.findById(message._id)
    .populate('senderId', 'name email avatar role')
    .lean();

  if (populated && populated.senderId && typeof populated.senderId === 'object') {
    (populated.senderId as any).avatar = await normalizeAssetUrl((populated.senderId as any).avatar);
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`dm:${targetUserId}`).emit('new-dm', populated);
  }

  // Notify client
  const notification = await Notification.create({
    recipientId: targetUserId,
    senderId: adminId,
    type: 'MESSAGE',
    content: 'New DM from studio',
    messageId: message._id,
  });

  if (io) {
    const populatedNotif = await Notification.findById(notification._id).populate('senderId', 'name avatar').lean();
    io.to(`user:${targetUserId}`).emit('new-notification', populatedNotif);
  }

  res.status(201).json({ success: true, data: populated });
});

// Admin: List all recent messages across all orders
export const listAllRecentMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit || '10'), 50);
  const messages = await Message.find({ isDirectMessage: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderId', 'name avatar')
    .populate('orderId', 'orderNumber title')
    .lean();
  
  res.json({ success: true, data: messages });
});
