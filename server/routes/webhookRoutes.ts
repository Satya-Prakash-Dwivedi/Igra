import { Router } from 'express';
import { verifyPaypalWebhook } from '../middleware/verifyPaypalWebhook.js';
import { verifyRazorpayWebhook } from '../middleware/verifyRazorpayWebhook.js';
import * as billingCtrl from '../controllers/billingController.js';

const router = Router();

// PayPal webhook — public endpoint with signature verification
router.post('/paypal', verifyPaypalWebhook, billingCtrl.handleWebhook);

// Razorpay webhook — public endpoint with HMAC verification
router.post('/razorpay', verifyRazorpayWebhook, billingCtrl.handleRazorpayWebhook);

export default router;
