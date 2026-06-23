import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import User from '../models/User.js';

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
    const defaultAdminEmail = process.env.DEFAULT_FROM_EMAIL || '';

    // Fetch all admins from DB
    const admins = await User.find({ role: 'admin' }).select('email').lean();
    const adminEmails = Array.from(new Set([
        defaultAdminEmail,
        ...admins.map(a => a.email)
    ])).filter(Boolean);

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

        // Send to Admin(s)
        await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: senderEmail, name: "Igra Studios" },
                to: adminEmails.map(email => ({ email })),
                subject: `🚨 New Order Alert - #${order.orderNumber}`,
                htmlContent: adminHtml
            })
        });

        logger.info(`Order placement emails sent for #${order.orderNumber}. Client: ${user.email}, Admins: ${adminEmails.join(', ')}`);
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

export const sendFinalAssetsDeliveryEmail = async (order: any, user: any) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const orderUrl = `${clientUrl}/orders/${order._id}`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Final Assets Delivered!</h2>
            <p>Hi ${user.name},</p>
            <p>The admin has posted the final assets for your order <strong>#${order.orderNumber}</strong>.</p>
            <p>Please go through the final assets and give your thumbs up for the order completion.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${orderUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Final Assets</a>
            </div>
            <p>Thank you for choosing Igra Studios!</p>
        </div>
    `;

    try {
        const apiKey = process.env.EMAIL_API_KEY || '';
        const senderEmail = process.env.DEFAULT_FROM_EMAIL || '';

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: senderEmail, name: "Igra Studios" },
                to: [{ email: user.email }],
                subject: `Final Assets Posted for Order #${order.orderNumber}`,
                htmlContent: htmlContent
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            logger.error(`Brevo API error: ${response.status} ${errorData}`);
            throw new Error(`Brevo API error: ${response.status}`);
        }

        logger.info(`Final assets delivery email sent to ${user.email} for #${order.orderNumber}`);
    } catch (error) {
        logger.error(`Error sending final assets delivery email for #${order.orderNumber}:`, error);
    }
};

export const sendDeliveryAcceptanceEmails = async (order: any, user: any, items: any[]) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const orderUrl = `${clientUrl}/orders/${order._id}`;
    const adminUrl = `${clientUrl}/admin/orders/${order._id}`;
    const adminEmail = process.env.DEFAULT_FROM_EMAIL || '';

    // Generate summary of items and their deliverables
    let itemsSummaryHtml = '';
    items.forEach((item: any) => {
        const kindFormatted = item.kind.replace(/_/g, ' ');
        itemsSummaryHtml += `
            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e9ecef; border-radius: 8px; background-color: #f8f9fa;">
                <h4 style="margin: 0 0 10px 0; color: #333; text-transform: uppercase; font-size: 14px;">${kindFormatted}</h4>
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;"><strong>Credits:</strong> ${item.creditsQuoted}</p>
        `;

        const deliverables = (item.assets || []).filter((a: any) => a.role === 'OUTPUT');
        const deliveryLinks = item.deliveryLinks || [];

        if (deliverables.length > 0 || deliveryLinks.length > 0) {
            itemsSummaryHtml += `<p style="margin: 0 0 5px 0; font-size: 12px; color: #333;"><strong>Deliverables:</strong></p><ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #007bff;">`;
            
            deliverables.forEach((asset: any) => {
                itemsSummaryHtml += `<li style="margin-bottom: 5px;"><a href="${asset.url}" target="_blank" style="text-decoration: none; color: #007bff;">${asset.originalName || 'Download File'}</a></li>`;
            });

            deliveryLinks.forEach((link: string) => {
                itemsSummaryHtml += `<li style="margin-bottom: 5px;"><a href="${link}" target="_blank" style="text-decoration: none; color: #007bff;">${link}</a> (External Link)</li>`;
            });

            itemsSummaryHtml += `</ul>`;
        } else {
            itemsSummaryHtml += `<p style="margin: 0; font-size: 12px; color: #999; font-style: italic;">No deliverables attached.</p>`;
        }

        itemsSummaryHtml += `</div>`;
    });

    // 1. Client Email content
    const clientHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #28a745;">Delivery Accepted!</h2>
            <p>Hi ${user.name},</p>
            <p>You have successfully accepted the delivery of the assets for order <strong>#${order.orderNumber}</strong>.</p>
            <p>Below is a record of your accepted assets and deliverables:</p>
            ${itemsSummaryHtml}
            <div style="text-align: center; margin: 30px 0;">
                <a href="${orderUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Order Details</a>
            </div>
            <p>Thank you for choosing Igra Studios!</p>
        </div>
    `;

    // 2. Admin Email content
    const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #28a745;">Client Accepted Assets</h2>
            <p>Hi Admin,</p>
            <p>The client <strong>${user.name}</strong> (${user.email}) has successfully accepted the delivery and agreed with the given assets for order <strong>#${order.orderNumber}</strong>.</p>
            <p>Below is a record of the accepted assets and deliverables:</p>
            ${itemsSummaryHtml}
            <div style="text-align: center; margin: 30px 0;">
                <a href="${adminUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Accepted Order</a>
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
                subject: `Delivery Accepted - Order #${order.orderNumber}`,
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
                subject: `✅ Client Accepted Assets - Order #${order.orderNumber}`,
                htmlContent: adminHtml
            })
        });

        logger.info(`Delivery acceptance emails sent for #${order.orderNumber}`);
    } catch (error) {
        logger.error(`Error sending delivery acceptance emails for #${order.orderNumber}:`, error);
    }
};

export const sendRevisionRequestEmail = async (order: any, item: any, user: any, notes?: string, assets?: any[]) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const adminUrl = `${clientUrl}/admin/orders/${order._id}`;

    // Fetch all admins from DB
    const defaultAdminEmail = process.env.DEFAULT_FROM_EMAIL || '';
    const admins = await User.find({ role: 'admin' }).select('email').lean();
    const adminEmails = Array.from(new Set([
        defaultAdminEmail,
        ...admins.map(a => a.email)
    ])).filter(Boolean);

    const kindFormatted = item.kind.replace(/_/g, ' ');
    const notesHtml = notes ? `<p style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; font-style: italic;">"${notes}"</p>` : '<p style="font-style: italic; color: #999;">No specific revision notes provided.</p>';

    let assetsHtml = '';
    if (assets && assets.length > 0) {
        const baseUrl = process.env.VITE_API_URL || 'http://localhost:5000';
        assetsHtml = `
            <p><strong>Attached Reference Files:</strong></p>
            <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #007bff; margin-bottom: 20px;">
        `;
        assets.forEach((asset: any) => {
            const fileUrl = asset.url.startsWith('http') ? asset.url : `${baseUrl}${asset.url}`;
            assetsHtml += `<li style="margin-bottom: 5px;"><a href="${fileUrl}" target="_blank" style="text-decoration: none; color: #007bff;">${asset.originalName}</a></li>`;
        });
        assetsHtml += `</ul>`;
    }

    const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #d39e00;">Revision Requested</h2>
            <p>The client <strong>${user.name}</strong> (${user.email}) has requested a revision for order <strong>#${order.orderNumber}</strong>.</p>
            <p><strong>Service:</strong> ${kindFormatted}</p>
            <p><strong>Revision Details:</strong></p>
            ${notesHtml}
            ${assetsHtml}
            <div style="text-align: center; margin: 30px 0;">
                <a href="${adminUrl}" style="background-color: #ffc107; color: black; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Request</a>
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
                to: adminEmails.map(email => ({ email })),
                subject: `⚠️ Revision Requested - Order #${order.orderNumber}`,
                htmlContent: adminHtml
            })
        });

        logger.info(`Revision request emails sent to admins for #${order.orderNumber}`);
    } catch (error) {
        logger.error(`Error sending revision request emails for #${order.orderNumber}:`, error);
    }
};

export const sendRevisionDeliveredEmail = async (order: any, item: any, user: any) => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const orderUrl = `${clientUrl}/orders/${order._id}`;
    const kindFormatted = item.kind.replace(/_/g, ' ');

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #28a745;">Revision Delivered!</h2>
            <p>Hi ${user.name},</p>
            <p>The production team has delivered the revision for service <strong>${kindFormatted}</strong> on order <strong>#${order.orderNumber}</strong>.</p>
            <p>Please review the updated deliverables and approve them if everything looks good.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${orderUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Updated Deliverables</a>
            </div>
            <p>Thank you for choosing Igra Studios!</p>
        </div>
    `;

    try {
        const apiKey = process.env.EMAIL_API_KEY || '';
        const senderEmail = process.env.DEFAULT_FROM_EMAIL || '';

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: senderEmail, name: "Igra Studios" },
                to: [{ email: user.email }],
                subject: `Revision Delivered for Order #${order.orderNumber} - ${kindFormatted}`,
                htmlContent: htmlContent
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            logger.error(`Brevo API error: ${response.status} ${errorData}`);
            throw new Error(`Brevo API error: ${response.status}`);
        }

        logger.info(`Revision delivered email sent to ${user.email} for #${order.orderNumber}`);
    } catch (error) {
        logger.error(`Error sending revision delivered email for #${order.orderNumber}:`, error);
    }
};

export const sendContactFormEmail = async (contactData: any) => {
    const { name, email, phone, company, service, budget, message, source } = contactData;

    // Fetch all admins from DB
    const defaultAdminEmail = process.env.DEFAULT_FROM_EMAIL || '';
    const admins = await User.find({ role: 'admin' }).select('email').lean();
    const adminEmails = Array.from(new Set([
        defaultAdminEmail,
        ...admins.map(a => a.email)
    ])).filter(Boolean);

    const escapeHtml = (value: string = "") => {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const submittedAt = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background: #f6f6f6; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e5e5;">
          
          <div style="background: #0a0a0a; color: #ffffff; padding: 24px;">
            <h1 style="margin: 0; font-size: 22px;">New Contact Form Submission</h1>
            <p style="margin: 8px 0 0; color: #cccccc;">Igra Studios website</p>
          </div>
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #666666; width: 140px;">Name</td>
                <td style="padding: 10px 0; font-weight: 600;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666666;">Email</td>
                <td style="padding: 10px 0;">
                  <a href="mailto:${escapeHtml(email)}" style="color: #ff4533;">${escapeHtml(email)}</a>
                </td>
              </tr>
              ${phone ? `
              <tr>
                <td style="padding: 10px 0; color: #666666;">Phone</td>
                <td style="padding: 10px 0;">${escapeHtml(phone)}</td>
              </tr>` : ""}
              ${company ? `
              <tr>
                <td style="padding: 10px 0; color: #666666;">Company</td>
                <td style="padding: 10px 0;">${escapeHtml(company)}</td>
              </tr>` : ""}
              ${service ? `
              <tr>
                <td style="padding: 10px 0; color: #666666;">Service</td>
                <td style="padding: 10px 0;">${escapeHtml(service)}</td>
              </tr>` : ""}
              ${budget ? `
              <tr>
                <td style="padding: 10px 0; color: #666666;">Budget</td>
                <td style="padding: 10px 0;">${escapeHtml(budget)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding: 10px 0; color: #666666;">Submitted At</td>
                <td style="padding: 10px 0;">${submittedAt}</td>
              </tr>
              ${source ? `
              <tr>
                <td style="padding: 10px 0; color: #666666;">Source</td>
                <td style="padding: 10px 0;">${escapeHtml(source)}</td>
              </tr>` : ""}
            </table>
            <div style="margin-top: 24px;">
              <p style="margin: 0 0 8px; color: #666666;">Message</p>
              <div style="background: #f8f8f8; border: 1px solid #eeeeee; border-radius: 8px; padding: 16px; line-height: 1.6;">
                ${escapeHtml(message).replace(/\n/g, "<br />")}
              </div>
            </div>
            <div style="margin-top: 24px;">
              <a href="mailto:${escapeHtml(email)}" style="display: inline-block; background: #ff4533; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 999px; font-weight: 600;">
                Reply to ${escapeHtml(name)}
              </a>
            </div>
          </div>
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
                sender: { email: senderEmail, name: "Igra Studios Website" },
                to: adminEmails.map(adminEmail => ({ email: adminEmail })),
                replyTo: { email, name },
                subject: `New website inquiry from ${name}`,
                htmlContent
            })
        });

        logger.info(`Contact form submission email sent for ${email}`);
    } catch (error) {
        logger.error(`Error sending contact form email for ${email}:`, error);
        throw error;
    }
};
