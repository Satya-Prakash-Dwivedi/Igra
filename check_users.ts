import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './server/models/User.js';

dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI || '');
    const roles = await User.distinct('role');
    console.log('Roles in DB:', roles);
    const users = await User.find({}).select('name email role');
    console.log('Users in DB:', JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
