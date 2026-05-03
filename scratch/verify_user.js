import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../server/models/User.js';

dotenv.config();

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);
  await User.updateOne({ email: 'test@example.com' }, { isVerified: true });
  await mongoose.disconnect();
  console.log('User verified');
}

verify();
