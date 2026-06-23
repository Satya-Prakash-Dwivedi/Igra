import express from 'express';
import { submitContactForm } from '../controllers/contactController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Apply rate limiting to the contact form submission endpoint
const contactLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // Limit to 10 submissions per email
    message: {
        success: false,
        message: "Too many submissions. Please try again later.",
    },
    keyGenerator: (req) => {
        // Since requests come from Framer's IPs, rate limit by the user's email address instead of IP
        const payload = req.body?.data || req.body || {};
        return payload.Email || payload.email || req.ip;
    }
});

router.post('/', contactLimiter, submitContactForm);

export default router;
