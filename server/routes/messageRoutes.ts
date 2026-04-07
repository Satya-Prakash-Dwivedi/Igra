import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as messageCtrl from '../controllers/messageController.js';

const router = Router();

router.use(authenticate);

// Messages are nested under /orders/:id/messages
router.get('/:id/messages',  messageCtrl.getMessages);
router.post('/:id/messages', messageCtrl.sendMessage);

export default router;
