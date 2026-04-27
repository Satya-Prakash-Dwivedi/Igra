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
