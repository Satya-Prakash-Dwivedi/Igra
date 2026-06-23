import type { Request, Response } from 'express';
import { sendContactFormEmail } from '../services/emailService.js';
import logger from '../utils/logger.js';

export const submitContactForm = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = req.body || {};

        // Helper to find a field by a list of possible names
        const getField = (keys: string[]) => {
            for (const key of keys) {
                if (payload[key] && typeof payload[key] === 'string') {
                    return payload[key].trim();
                }
            }
            return '';
        };

        const firstName = getField(['First Name', 'firstName', 'first_name', 'name']);
        const lastName = getField(['Last Name', 'lastName', 'last_name']);
        const name = [firstName, lastName].filter(Boolean).join(' ');

        const email = getField(['Email', 'email']);
        const phone = getField(['Phone', 'phone']);
        const company = getField(['Company', 'company']);
        const service = getField(['Services', 'services', 'Service', 'service']);
        const budget = getField(['Budget', 'budget']);

        const businessMsg = getField(['Business', 'business']);
        const explicitMessage = getField(['Message', 'message']);
        const message = explicitMessage || businessMsg;

        const source = getField(['Source', 'source']) || 'Contact Page';
        const website = getField(['Website', 'website', 'websiteUrl']); // Honeypot field

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
