import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../server/models/User.js';
import Order from '../server/models/Order.js';

dotenv.config();

async function checkIds() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'test@example.com' });
  const order = await Order.findOne({ orderNumber: { $regex: 'TEST-ORDER' } }).sort({ createdAt: -1 });
  
  console.log('User ID:', user?._id.toString());
  console.log('Order User ID:', order?.userId.toString());
  console.log('Order ID:', order?._id.toString());
  
  await mongoose.disconnect();
}

checkIds();
