import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../server/models/User.js';

dotenv.config();

async function verify() {
  try {
    await mongoose.connect(process.env.MONGO_URI || '');
    await User.updateOne({ email: 'test@igrastudios.com' }, { isVerified: true });
    console.log('User test@igrastudios.com verified successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
verify();
