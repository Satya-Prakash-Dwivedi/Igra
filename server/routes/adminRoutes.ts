import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.ts';
import * as adminCtrl from '../controllers/adminController.ts';

const router = Router();

// All admin routes require authentication + admin/staff role
router.use(authenticate);
router.use(authorize('admin', 'staff'));

// ─── Dashboard ────────────────────────────────────────────────
router.get('/dashboard',                          adminCtrl.getDashboardStats);

// ─── Orders ───────────────────────────────────────────────────
router.get('/orders',                             adminCtrl.listAllOrders);
router.patch('/orders/:id/review',                adminCtrl.reviewOrder);
router.patch('/orders/:id/assign',                adminCtrl.assignOrder);
router.patch('/orders/:oid/items/:iid/status',    adminCtrl.transitionItemStatus);
router.post('/orders/:oid/items/:iid/deliver',    adminCtrl.deliverItem);
router.post('/orders/:oid/items/:iid/refund',     adminCtrl.refundItem);

// ─── Staff ────────────────────────────────────────────────────
router.get('/staff',                              adminCtrl.listStaff);

// ─── Support (Gap 6) ──────────────────────────────────────────
router.get('/support/tickets',                    adminCtrl.listTickets);
router.get('/support/bugs',                       adminCtrl.listBugReports);
router.patch('/support/tickets/:id/status',       adminCtrl.updateTicketStatus);
router.patch('/support/bugs/:id/status',          adminCtrl.updateBugReportStatus);

export default router;
