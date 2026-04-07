import { Router } from 'express';
import { verifyPaypalWebhook } from '../middleware/verifyPaypalWebhook.js';
import * as billingCtrl from '../controllers/billingController.js';

const router = Router();

// PayPal webhook — public endpoint with signature verification
router.post('/paypal', verifyPaypalWebhook, billingCtrl.handleWebhook);

export default router;
