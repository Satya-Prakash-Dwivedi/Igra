import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as creditCtrl from '../controllers/creditController.js';

const router = Router();

router.use(authenticate);

router.get('/wallet', creditCtrl.getWallet);
router.get('/ledger', creditCtrl.getLedger);

export default router;
