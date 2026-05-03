import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../server/models/User.js';
import Order from '../server/models/Order.js';
import OrderItem from '../server/models/OrderItem.js';
import Asset from '../server/models/Asset.js';
import AssetLink from '../server/models/AssetLink.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/igra';

async function seedComplexOrder() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  let user = await User.findOne({ email: 'test@example.com' });
  if (!user) {
    user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    });
  }

  const order = await Order.create({
    orderNumber: `TEST-ORDER-${Date.now()}`,
    userId: user._id,
    idempotencyKey: `seed-${Date.now()}`,
    title: 'Complex Test Order',
    status: 'IN_PROGRESS'
  });

  console.log('Created Order:', order._id);

  for (let i = 0; i < 10; i++) {
    const item = await OrderItem.create({
      orderId: order._id,
      kind: 'LOGO_DESIGN',
      status: 'IN_PROGRESS',
      creditsQuoted: 100,
      params: { text: `Item ${i}` },
      pricingSnapshot: {
        base: 100,
        totalCredits: 100,
        inputs: { text: `Item ${i}` },
        priceVersion: 'v1',
        modifiers: []
      }
    });

    for (let j = 0; j < 5; j++) {
      const asset = await Asset.create({
        ownerUserId: user._id,
        originalName: `asset-${i}-${j}.png`,
        mimeType: 'image/png',
        sizeBytes: 1024
      });

      await AssetLink.create({
        orderItemId: item._id,
        assetId: asset._id,
        role: 'INPUT',
        orderIndex: j
      });
    }
  }

  console.log('Seed complete');
  await mongoose.disconnect();
}

seedComplexOrder();
