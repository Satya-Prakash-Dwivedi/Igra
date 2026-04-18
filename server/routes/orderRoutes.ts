import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { requireIdempotencyKey } from '../middleware/idempotency.js';
import * as orderCtrl from '../controllers/orderController.js';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// ─── User Routes ──────────────────────────────────────────────
router.post('/',                        requireIdempotencyKey, orderCtrl.createOrder);
router.get('/',                         orderCtrl.listOrders);
router.get('/:id',                      orderCtrl.getOrderDetail);
router.post('/:id/items',               orderCtrl.addItem);
router.delete('/:id/items/:iid',        orderCtrl.removeItem);
router.post('/:id/submit',              requireIdempotencyKey, orderCtrl.submitOrder);
router.patch('/:id/cancel',             orderCtrl.cancelOrder);

// ─── Item Actions (User) ─────────────────────────────────────
router.post('/:oid/items/:iid/approve',  orderCtrl.approveItem);
router.post('/:oid/items/:iid/revision', orderCtrl.requestRevision);
router.post('/:oid/items/:iid/assets',   orderCtrl.addAssetToItem);

export default router;
