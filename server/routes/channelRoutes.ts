import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as channelCtrl from '../controllers/channelController.js';

const router = Router();

// All channel routes require an authenticated user
router.use(authenticate);

router.get('/',     channelCtrl.listChannels);
router.post('/',    channelCtrl.createChannel);
router.get('/:id',  channelCtrl.getChannel);
router.patch('/:id', channelCtrl.updateChannel);
router.delete('/:id', channelCtrl.deleteChannel);

export default router;
