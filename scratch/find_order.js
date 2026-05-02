import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/igra';

async function findOrder() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  
  const order = await db.collection('orders').findOne({});
  if (order) {
    console.log('Found Order:', order._id.toString());
    const items = await db.collection('orderitems').find({ orderId: order._id }).toArray();
    console.log('Items Count:', items.length);
  } else {
    console.log('No orders found');
  }
  
  await mongoose.disconnect();
}

findOrder();
