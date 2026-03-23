import { Router } from 'express';
import { verifyPaypalWebhook } from '../middleware/verifyPaypalWebhook.ts';
import * as billingCtrl from '../controllers/billingController.ts';

const router = Router();

// PayPal webhook — public endpoint with signature verification
router.post('/paypal', verifyPaypalWebhook, billingCtrl.handleWebhook);

export default router;
