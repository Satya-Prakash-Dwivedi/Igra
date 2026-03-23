import { Router } from 'express';
import { authenticate } from '../middleware/auth.ts';
import * as creditCtrl from '../controllers/creditController.ts';

const router = Router();

router.use(authenticate);

router.get('/wallet', creditCtrl.getWallet);
router.get('/ledger', creditCtrl.getLedger);

export default router;
