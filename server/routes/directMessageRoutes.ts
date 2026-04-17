import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as messageCtrl from '../controllers/messageController.js';

const router = Router();

router.use(authenticate);

router.get('/',  messageCtrl.getDirectMessages);
router.post('/', messageCtrl.sendDirectMessage);

export default router;
