import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './server/models/User.js';

dotenv.config();

async function reset() {
  try {
    await mongoose.connect(process.env.MONGO_URI || '');
    
    const users = await User.find({});
    for (const user of users) {
      if (user.role === 'admin') {
        user.password = 'ChangeMe@123';
      } else {
        user.password = 'Password123';
      }
      // Save triggers the pre-save bcrypt hashing hook in User schema
      await user.save();
    }
    
    console.log('✅ Passwords successfully updated!');
    console.log('Admins are set to "ChangeMe@123"');
    console.log('Staff and Regular Users are set to "Password123"');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
reset();
