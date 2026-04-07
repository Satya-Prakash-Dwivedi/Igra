import mongoose from 'mongoose';
import Payment, { PaymentStatus } from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import { CREDIT_PACKS } from '../config/serviceCatalog.js';
import * as creditService from './creditService.js';
import { LedgerReason, LedgerRefType } from '../models/CreditLedgerEntry.js';
import { generateInvoiceNumber } from '../utils/generateOrderNumber.js';
import paypal from '@paypal/checkout-server-sdk';
import logger from '../utils/logger.js';

function getPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_SECRET || '';
  const environment = process.env.PAYPAL_MODE === 'live' 
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

/**
 * Create a PayPal order for a credit pack purchase.
 */
export async function createPurchase(
  userId: string,
  packId: string,
  idempotencyKey: string
) {
  // Idempotency
  const existing = await Payment.findOne({ idempotencyKey });
  if (existing) return existing;

  const pack = CREDIT_PACKS.find(p => p.id === packId);
  if (!pack) throw new Error(`Unknown credit pack: ${packId}`);

  const paypalClient = getPayPalClient();
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: packId,
      amount: { currency_code: 'USD', value: (pack.priceCents / 100).toFixed(2) },
      description: `${pack.name} Credit Pack`,
    }],
    application_context: {
      return_url: `${process.env.CLIENT_URL}/credits?paypalFlow=true`,
      cancel_url: `${process.env.CLIENT_URL}/credits?paypalCancel=true`,
      user_action: 'PAY_NOW'
    }
  });

  const ppOrder = await paypalClient.execute(request);
  const paypalOrderId = ppOrder.result.id;
  const approveLink = ppOrder.result.links?.find((l: any) => l.rel === 'approve')?.href;

  const payment = await Payment.create({
    userId,
    provider: 'paypal',
    paypalOrderId,
    amountCents: pack.priceCents,
    currency: 'USD',
    creditsPurchased: pack.credits,
    packId: pack.id,
    status: PaymentStatus.CREATED,
    idempotencyKey,
  });

  return {
    payment,
    approveLink,
  };
}

/**
 * Capture a PayPal payment and credit the user's wallet.
 */
export async function capturePurchase(paymentIdOrPaypalOrderId: string, userId: string) {
  let payment;
  if (mongoose.Types.ObjectId.isValid(paymentIdOrPaypalOrderId)) {
    payment = await Payment.findOne({ _id: paymentIdOrPaypalOrderId, userId });
  } else {
    payment = await Payment.findOne({ paypalOrderId: paymentIdOrPaypalOrderId, userId });
  }
  if (!payment) throw new Error('Payment not found');

  // Atomically claim the payment to prevent race conditions between frontend and webhook
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: PaymentStatus.CAPTURED } },
    { $set: { status: PaymentStatus.CAPTURED } },
    { new: false } // Returns the old document (before update)
  );

  if (!claimed) {
    // Another thread concurrently marked it CAPTURED
    return await Payment.findById(payment._id);
  }

  try {
    const paypalClient = getPayPalClient();
    const request = new paypal.orders.OrdersCaptureRequest(payment.paypalOrderId);
    request.requestBody({} as any);
    
    const capture = await paypalClient.execute(request);
    const captureId = capture.result.purchase_units[0].payments.captures[0].id;

    payment.paypalCaptureId = captureId;
    payment.status = PaymentStatus.CAPTURED;
    payment.capturedAt = new Date();
    await payment.save();

  // Credit the wallet
  const wallet = await creditService.getOrCreateWallet(userId);
  await creditService.appendLedgerEntry({
    walletId: wallet._id,
    delta: payment.creditsPurchased,
    reason: LedgerReason.PACK_PURCHASE,
    refType: LedgerRefType.PAYMENT,
    refId: payment._id,
    idempotencyKey: `purchase-${payment._id}`,
  });

    // Create invoice
    const pack = CREDIT_PACKS.find(p => p.id === payment.packId);
    await Invoice.create({
      userId,
      paymentId: payment._id,
      invoiceNumber: generateInvoiceNumber(),
      lineItems: [{
        description: `${pack?.name || payment.packId} Credit Pack — ${payment.creditsPurchased} credits`,
        quantity: 1,
        unitPriceCents: payment.amountCents,
        totalCents: payment.amountCents,
      }],
      subtotalCents: payment.amountCents,
      totalCents: payment.amountCents,
      currency: 'USD',
    });

    logger.info('billing.payment_captured', {
      paymentId: payment._id.toString(),
      paypalOrderId: payment.paypalOrderId,
      creditsPurchased: payment.creditsPurchased,
      userId,
    });

    return payment;
  } catch (err) {
    // Release the atomic lock if the capture throws an error so we can retry later
    await Payment.findByIdAndUpdate(payment._id, { status: PaymentStatus.CREATED });
    throw err;
  }
}

/**
 * Handle PayPal webhook (idempotent).
 */
export async function handlePayPalWebhook(paypalOrderId: string, eventType: string) {
  const payment = await Payment.findOne({ paypalOrderId });
  if (!payment) {
    logger.warn('billing.webhook_unknown_order', {
      paypalOrderId,
      eventType,
    });
    return;
  }

  // Already processed
  if (payment.status === PaymentStatus.CAPTURED) return;

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    await capturePurchase(payment._id.toString(), payment.userId.toString());
  }
}

/**
 * List invoices for a user.
 */
export async function listInvoices(userId: string, page = 1, limit = 20) {
  const invoices = await Invoice.find({ userId })
    .populate('paymentId', 'paypalOrderId paypalCaptureId')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const total = await Invoice.countDocuments({ userId });
  return { invoices, total, page, limit };
}

/**
 * Get invoice detail.
 */
export async function getInvoiceDetail(invoiceId: string, userId: string) {
  const invoice = await Invoice.findOne({ _id: invoiceId, userId }).lean();
  if (!invoice) throw new Error('Invoice not found');
  return invoice;
}

/**
 * List payments for a user.
 */
export async function listPayments(userId: string, page = 1, limit = 20) {
  const payments = await Payment.find({ userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const total = await Payment.countDocuments({ userId });
  return { payments, total, page, limit };
}
