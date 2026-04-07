import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireIdempotencyKey } from '../middleware/idempotency.js';
import * as billingCtrl from '../controllers/billingController.js';

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
