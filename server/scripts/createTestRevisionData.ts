import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User.js';
import Order, { OrderStatus } from '../models/Order.js';
import OrderItem, { OrderItemKind, OrderItemStatus } from '../models/OrderItem.js';
import * as userService from '../services/userService.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function createTestRevisionData() {
  const emailArg = 'testuser@example.com';
  const passwordArg = 'Password123!';

  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not found');
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    // 1. Create or Find User
    let user = await User.findOne({ email: emailArg });
    if (!user) {
      user = await userService.createUser({
        name: 'Test Revision User',
        email: emailArg,
        password: passwordArg,
      } as any);
      user.isVerified = true;
      await user.save();
      console.log(`👤 Created user: ${emailArg}`);
    } else {
      user.isVerified = true;
      await user.save();
      console.log(`👤 Found user: ${emailArg}`);
    }

    // 2. Create Order
    const order = new Order({
      orderNumber: `ORD-TEST-${Date.now()}`,
      userId: user._id,
      status: OrderStatus.COMPLETED,
      idempotencyKey: `idempotency_${Date.now()}`,
      title: 'Revision Test Order',
      totalCreditsQuoted: 50,
      totalCreditsCaptured: 50,
    });
    await order.save();
    console.log(`📦 Created order: ${order.orderNumber}`);

    // 3. Create OrderItem (Delivered)
    const item = new OrderItem({
      orderId: order._id,
      kind: OrderItemKind.VIDEO_EDIT,
      creditsQuoted: 50,
      status: OrderItemStatus.DELIVERED,
      pricingSnapshot: {
        priceVersion: 'v1',
        inputs: {},
        base: 50,
        modifiers: [],
        totalCredits: 50,
      },
      allowedRevisions: 2,
      usedRevisions: 0,
    });
    await item.save();
    console.log(`🎥 Created DELIVERED order item: ${item._id}`);

    console.log(`\n🎉 Data seeded! Login with:\nEmail: ${emailArg}\nPassword: ${passwordArg}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createTestRevisionData();
