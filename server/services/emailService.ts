import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const sendVerificationEmail = async (email: string, token: string) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyUrl = `${clientUrl}/verify-email?token=${token}`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Welcome to Igra Studios!</h2>
            <p>Thank you for registering. Please click the button below to verify your email address and activate your account.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not request this, please ignore this email.</p>
        </div>
    `;

    try {
        const apiKey = process.env.EMAIL_API_KEY || '';
        const senderEmail = process.env.DEFAULT_FROM_EMAIL || '';

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    email: senderEmail,
                    name: "Igra Studios"
                },
                to: [{ email }],
                subject: 'Verify your email - Igra Studios',
                htmlContent: htmlContent
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            logger.error(`Brevo API error: ${response.status} ${errorData}`);
            throw new Error(`Brevo API error: ${response.status}`);
        }

        logger.info(`Verification email sent to ${email}`);
    } catch (error) {
        logger.error(`Error sending verification email to ${email}:`, error);
        throw new Error('Failed to send verification email');
    }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset. Please click the button below to set a new password.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        </div>
    `;

    try {
        const apiKey = process.env.EMAIL_API_KEY || '';
        const senderEmail = process.env.DEFAULT_FROM_EMAIL || '';

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    email: senderEmail,
                    name: "Igra Studios"
                },
                to: [{ email }],
                subject: 'Reset your password - Igra Studios',
                htmlContent: htmlContent
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            logger.error(`Brevo API error: ${response.status} ${errorData}`);
            throw new Error(`Brevo API error: ${response.status}`);
        }

        logger.info(`Password reset email sent to ${email}`);
    } catch (error) {
        logger.error(`Error sending password reset email to ${email}:`, error);
        throw new Error('Failed to send password reset email');
    }
};

export const sendOrderPlacementEmails = async (order: any, user: any) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const orderUrl = `${clientUrl}/orders/${order._id}`;
    const adminEmail = process.env.DEFAULT_FROM_EMAIL || '';

    // 1. Client Confirmation
    const clientHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Order Confirmed!</h2>
            <p>Hi ${user.name},</p>
            <p>Your order <strong>#${order.orderNumber}</strong> has been successfully placed and is now under review.</p>
            <p><strong>Total Credits:</strong> ${order.totalCreditsCaptured}</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${orderUrl}" style="background-color: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Order Details</a>
            </div>
            <p>Thank you for choosing Igra Studios!</p>
        </div>
    `;

    // 2. Admin Alert
    const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>New Order Received</h2>
            <p>A new order has been placed by <strong>${user.name}</strong> (${user.email}).</p>
            <p><strong>Order Number:</strong> #${order.orderNumber}</p>
            <p><strong>Total Credits:</strong> ${order.totalCreditsCaptured}</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${clientUrl}/admin/orders/${order._id}" style="background-color: #ff4757; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Order</a>
            </div>
        </div>
    `;

    try {
        const apiKey = process.env.EMAIL_API_KEY || '';
        const senderEmail = process.env.DEFAULT_FROM_EMAIL || '';

        // Send to Client
        await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: senderEmail, name: "Igra Studios" },
                to: [{ email: user.email }],
                subject: `Order Confirmation - #${order.orderNumber}`,
                htmlContent: clientHtml
            })
        });

        // Send to Admin
        await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: senderEmail, name: "Igra Studios" },
                to: [{ email: adminEmail }],
                subject: `🚨 New Order Alert - #${order.orderNumber}`,
                htmlContent: adminHtml
            })
        });

        logger.info(`Order placement emails sent for #${order.orderNumber}. Client: ${user.email}, Admin: ${adminEmail}`);
    } catch (error) {
        logger.error(`Error sending order placement emails:`, error);
    }
};

export const sendMessageNotificationEmail = async (recipient: { email: string, name: string }, senderName: string, orderNumber: string | null, messageContent: string, orderId?: string) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const link = orderId ? `${clientUrl}/orders/${orderId}` : `${clientUrl}/messages`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>New Message Received</h2>
            <p>Hi ${recipient.name},</p>
            <p><strong>${senderName}</strong> sent you a new message${orderNumber ? ` regarding Order #${orderNumber}` : ''}:</p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; margin: 20px 0;">
                <p style="margin: 0; font-style: italic;">"${messageContent.length > 200 ? messageContent.substring(0, 200) + '...' : messageContent}"</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${link}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reply Now</a>
            </div>
        </div>
    `;

    try {
        const apiKey = process.env.EMAIL_API_KEY || '';
        const senderEmail = process.env.DEFAULT_FROM_EMAIL || '';

        await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: senderEmail, name: "Igra Studios" },
                to: [{ email: recipient.email }],
                subject: `New Message from ${senderName}`,
                htmlContent: htmlContent
            })
        });

        logger.info(`Message notification email sent to ${recipient.email}`);
    } catch (error) {
        logger.error(`Error sending message notification email:`, error);
    }
};
