import { Router } from 'express';
import { authenticate } from '../middleware/auth.ts';
import * as supportCtrl from '../controllers/supportController.ts';

const router = Router();

// All support routes require authentication
router.use(authenticate);

router.post('/tickets', supportCtrl.createTicket);
router.post('/bugs',    supportCtrl.createBugReport);

export default router;
