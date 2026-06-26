import mongoose from 'mongoose';
import Payment, { PaymentStatus } from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import { CREDIT_PACKS } from '../config/serviceCatalog.js';
import * as creditService from './creditService.js';
import { LedgerReason, LedgerRefType } from '../models/CreditLedgerEntry.js';
import { generateInvoiceNumber } from '../utils/generateOrderNumber.js';
import paypal from '@paypal/checkout-server-sdk';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import Order from '../models/Order.js';

let cachedExchangeRate: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

async function getUsdToInrRate(): Promise<number> {
  const now = Date.now();
  if (cachedExchangeRate && (now - cachedExchangeRate.timestamp < CACHE_DURATION_MS)) {
    return cachedExchangeRate.rate;
  }
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && data.rates.INR) {
        cachedExchangeRate = { rate: data.rates.INR, timestamp: now };
        return data.rates.INR;
      }
    }
  } catch (err) {
    console.error('[billingService] Failed to fetch live exchange rate:', err);
  }
  // Fallback to env var or 86
  return Number(process.env.RAZORPAY_EXCHANGE_RATE_INR || 86);
}

function getPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_SECRET || '';
  const mode = process.env.PAYPAL_MODE || 'sandbox';
  const environment = (mode === 'live' || mode === 'production')
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(environment);
}

function getRazorpayClient() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });
}

/**
 * Create an order for a credit pack purchase via PayPal or Razorpay.
 */
export async function createPurchase(
  userId: string,
  packId: string,
  idempotencyKey: string,
  amountDollars?: number,
  provider: 'paypal' | 'razorpay' = 'paypal',
  targetCurrency?: string
) {
  // Simple deduplication logic
  const existingPayment = await Payment.findOne({ idempotencyKey });
  if (existingPayment) {
    if (existingPayment.status === PaymentStatus.FAILED) {
      // Allow retry
    } else {
      if (existingPayment.provider === 'paypal') {
        return { payment: existingPayment, approveLink: '' }; 
      }
      return { 
        payment: existingPayment, 
        razorpayOrderId: existingPayment.razorpayOrderId, 
        keyId: process.env.RAZORPAY_KEY_ID 
      };
    }
  }

  let amountCents = 0;
  let creditsPurchased = 0;
  let packName = '';

  if (packId === 'custom') {
    if (!amountDollars || amountDollars < 5) throw new Error('Minimum custom purchase is $5');
    amountCents = Math.round(amountDollars * 100);
    // 1 Dollar = 1 Credit
    creditsPurchased = Math.floor(amountDollars);
    packName = 'Custom';
  } else {
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) throw new Error(`Unknown credit pack: ${packId}`);
    amountCents = pack.priceCents;
    creditsPurchased = pack.credits;
    packName = pack.name;
  }

  if (provider === 'razorpay') {
    const rzpClient = getRazorpayClient();
    const currency = targetCurrency || process.env.RAZORPAY_CURRENCY || 'USD';
    let rzpAmount = amountCents; // Cents for USD
    if (currency === 'INR') {
      const rate = await getUsdToInrRate();
      rzpAmount = Math.round((amountCents / 100) * rate * 100); // in paise
    }

    const rzpOrder = await rzpClient.orders.create({
      amount: rzpAmount,
      currency,
      receipt: idempotencyKey.slice(0, 40),
      notes: { packId, userId, credits: creditsPurchased.toString() },
    });

    const payment = await Payment.create({
      userId,
      provider: 'razorpay',
      razorpayOrderId: rzpOrder.id,
      amountCents,
      currency: 'USD',
      creditsPurchased,
      packId,
      status: PaymentStatus.CREATED,
      idempotencyKey,
    });

    return {
      payment,
      razorpayOrderId: rzpOrder.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    };
  }

  const paypalClient = getPayPalClient();
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: packId,
      amount: { currency_code: 'USD', value: (amountCents / 100).toFixed(2) },
      description: `${packName} Credit Pack`,
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
    amountCents,
    currency: 'USD',
    creditsPurchased,
    packId,
    status: PaymentStatus.CREATED,
    idempotencyKey,
  });

  return {
    payment,
    approveLink,
  };
}

/**
 * Capture a payment (PayPal or Razorpay) and credit the user's wallet.
 */
export async function capturePurchase(
  paymentIdOrOrderId: string,
  userId: string,
  razorpayAuthData?: {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature?: string | null;
  }
) {
  let payment;
  if (mongoose.Types.ObjectId.isValid(paymentIdOrOrderId)) {
    payment = await Payment.findOne({ _id: paymentIdOrOrderId, userId });
  } else {
    payment = await Payment.findOne({
      $or: [{ paypalOrderId: paymentIdOrOrderId }, { razorpayOrderId: paymentIdOrOrderId }],
      userId,
    });
  }
  if (!payment) throw new Error('Payment not found');

  if (payment.provider === 'razorpay') {
    if (razorpayAuthData && razorpayAuthData.razorpaySignature) {
      const secret = process.env.RAZORPAY_KEY_SECRET || '';
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(razorpayAuthData.razorpayOrderId + '|' + razorpayAuthData.razorpayPaymentId)
        .digest('hex');

      if (expectedSig !== razorpayAuthData.razorpaySignature) {
        throw new Error('Invalid Razorpay signature');
      }
    }
  }

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
    if (payment.provider === 'paypal') {
      const paypalClient = getPayPalClient();
      const request = new paypal.orders.OrdersCaptureRequest(payment.paypalOrderId!);
      request.requestBody({} as any);
      
      const capture = await paypalClient.execute(request);
      const captureId = capture.result.purchase_units[0].payments.captures[0].id;

      payment.paypalCaptureId = captureId;
    } else if (payment.provider === 'razorpay') {
      if (razorpayAuthData) {
        payment.razorpayPaymentId = razorpayAuthData.razorpayPaymentId;
        if (razorpayAuthData.razorpaySignature) {
          payment.razorpaySignature = razorpayAuthData.razorpaySignature;
        }
      }
    }

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
        description: `${pack?.name || 'Custom'} Credit Pack — ${payment.creditsPurchased} credits`,
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
      provider: payment.provider,
      creditsPurchased: payment.creditsPurchased,
      userId,
    });

    return payment;
  } catch (err) {
    // Release the atomic lock if the capture throws an error so we can retry later
    await Payment.findByIdAndUpdate(payment._id, { status: PaymentStatus.CREATED });
    logger.error('billing.payment_capture_failed_needs_reconciliation', {
      paymentId: payment._id.toString(),
      error: err,
    });
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

  if (payment.status === PaymentStatus.CAPTURED) return;

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    await capturePurchase(payment._id.toString(), payment.userId.toString());
  }
}

/**
 * Handle Razorpay webhook (idempotent).
 */
export async function handleRazorpayWebhook(razorpayOrderId: string, razorpayPaymentId: string) {
  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    logger.warn('billing.razorpay_webhook_unknown_order', { razorpayOrderId });
    return;
  }

  if (payment.status === PaymentStatus.CAPTURED) return;

  await capturePurchase(payment._id.toString(), payment.userId.toString(), {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature: null,
  });
}

/**
 * List invoices for a user.
 */
export async function listInvoices(userId: string, page = 1, limit = 20) {
  const invoices = await Invoice.find({ userId })
    .populate('paymentId', 'provider paypalOrderId paypalCaptureId razorpayOrderId razorpayPaymentId')
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
  const invoice = await Invoice.findOne({ _id: invoiceId, userId })
    .populate('paymentId', 'provider paypalOrderId paypalCaptureId razorpayOrderId razorpayPaymentId')
    .lean();
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
