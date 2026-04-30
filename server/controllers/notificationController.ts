import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import asyncHandler from 'express-async-handler';
import Notification from '../models/Notification.js';

export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!._id;
  const notifications = await Notification.find({ recipientId: userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('senderId', 'name avatar')
    .lean();
  
  res.json({ success: true, data: notifications });
});

export const markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!._id;
  const notificationId = req.params.id;
  
  await Notification.updateOne(
    { _id: notificationId, recipientId: userId },
    { $set: { isRead: true } }
  );
  
  res.json({ success: true });
});

export const markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!._id;
  
  await Notification.updateMany(
    { recipientId: userId, isRead: false },
    { $set: { isRead: true } }
  );
  
  res.json({ success: true });
});
