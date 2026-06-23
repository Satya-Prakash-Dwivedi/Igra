import express from 'express';
import { submitContactForm } from '../controllers/contactController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Apply rate limiting to the contact form submission endpoint
const contactLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Limit each IP to 5 requests per `window`
    message: {
        success: false,
        message: "Too many submissions. Please try again later.",
    },
});

router.post('/', contactLimiter, submitContactForm);

export default router;
