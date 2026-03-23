import { Router } from 'express';
import { authenticate } from '../middleware/auth.ts';
import { requireIdempotencyKey } from '../middleware/idempotency.ts';
import * as billingCtrl from '../controllers/billingController.ts';

const router = Router();

// Public
router.get('/packs', billingCtrl.getCreditPacks);

// Authenticated
router.use(authenticate);
router.post('/purchase',              requireIdempotencyKey, billingCtrl.createPurchase);
router.post('/purchase/:id/capture',  billingCtrl.capturePurchase);
router.get('/invoices',               billingCtrl.listInvoices);
router.get('/invoices/:id',           billingCtrl.getInvoiceDetail);

export default router;
