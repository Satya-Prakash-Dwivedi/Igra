import type { Request, Response } from 'express';
import { sendContactFormEmail } from '../services/emailService.js';
import logger from '../utils/logger.js';

export const submitContactForm = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            name,
            email,
            phone,
            company,
            service,
            budget,
            message,
            source,
            website // Honeypot field
        } = req.body;

        // 1. Honeypot check
        if (website) {
            // Silently pretend it worked for bots
            res.status(200).json({ success: true, message: 'Contact form submitted successfully.' });
            return;
        }

        // 2. Validation
        if (!name || !email || !message) {
            res.status(400).json({
                success: false,
                message: "Name, email, and message are required.",
            });
            return;
        }

        const isValidEmail = (emailStr: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
        if (!isValidEmail(email)) {
            res.status(400).json({
                success: false,
                message: "Please enter a valid email address.",
            });
            return;
        }

        // 3. Send Email
        await sendContactFormEmail({
            name, email, phone, company, service, budget, message, source
        });

        res.status(200).json({
            success: true,
            message: "Contact form submitted successfully.",
        });
    } catch (error) {
        logger.error("Contact form controller error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to submit contact form right now.",
        });
    }
};
