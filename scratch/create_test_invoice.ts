import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../server/models/User.js';
import Payment, { PaymentStatus } from '../server/models/Payment.js';
import Invoice from '../server/models/Invoice.js';
import { generateInvoiceNumber } from '../server/utils/generateOrderNumber.js';

dotenv.config();

async function createTestInvoice() {
  try {
    await mongoose.connect(process.env.MONGO_URI || '');
    console.log('Connected to DB');

    const user = await User.findOne({ email: 'test@igrastudios.com' });
    if (!user) {
      console.error('User dummy@example.com not found');
      process.exit(1);
    }

    // Create a dummy payment
    const payment = await Payment.create({
      userId: user._id,
      paypalOrderId: `TEST-ORDER-${Date.now()}`,
      amountCents: 5000,
      creditsPurchased: 350,
      packId: 'starter',
      status: PaymentStatus.CAPTURED,
      idempotencyKey: `test-idemp-${Date.now()}`,
      capturedAt: new Date()
    });

    // Create a dummy invoice
    const invoice = await Invoice.create({
      userId: user._id,
      paymentId: payment._id,
      invoiceNumber: generateInvoiceNumber(),
      lineItems: [{
        description: 'Starter Credit Pack — 350 credits',
        quantity: 1,
        unitPriceCents: 5000,
        totalCents: 5000,
      }],
      subtotalCents: 5000,
      totalCents: 5000,
      currency: 'USD',
    });

    console.log('Test Invoice created successfully:', invoice.invoiceNumber);
    process.exit(0);
  } catch (err) {
    console.error('Error creating test invoice:', err);
    process.exit(1);
  }
}

createTestInvoice();
