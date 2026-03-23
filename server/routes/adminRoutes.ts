import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.ts';
import * as adminCtrl from '../controllers/adminController.ts';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize('admin', 'staff'));

router.get('/orders',                         adminCtrl.listAllOrders);
router.get('/dashboard',                      adminCtrl.getDashboardStats);
router.patch('/orders/:id/review',            adminCtrl.reviewOrder);
router.patch('/orders/:id/assign',            adminCtrl.assignOrder);
router.patch('/orders/:oid/items/:iid/status', adminCtrl.transitionItemStatus);
router.post('/orders/:oid/items/:iid/deliver', adminCtrl.deliverItem);
router.post('/orders/:oid/items/:iid/refund',  adminCtrl.refundItem);

export default router;
