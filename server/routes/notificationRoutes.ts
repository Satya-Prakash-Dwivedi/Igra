import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as notificationCtrl from '../controllers/notificationController.js';

const router = Router();

router.use(authenticate);

router.get('/',           notificationCtrl.getNotifications);
router.patch('/read-all', notificationCtrl.markAllAsRead);
router.patch('/:id/read', notificationCtrl.markAsRead);

export default router;
