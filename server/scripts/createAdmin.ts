import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User.js';
import * as userService from '../services/userService.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function createAdmin() {
  const args = process.argv.slice(2);
  const emailArg = args.find(a => a.startsWith('--email='))?.split('=')[1];
  const passwordArg = args.find(a => a.startsWith('--password='))?.split('=')[1] || 'Admin123!';
  const nameArg = args.find(a => a.startsWith('--name='))?.split('=')[1] || 'Admin User';

  if (!emailArg) {
    console.error('❌ Error: Please provide an email using --email=your@email.com');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not found in .env');
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    let user = await User.findOne({ email: emailArg });
    
    if (!user) {
      console.log(`👤 User not found. Creating new admin user: ${emailArg}`);
      user = await userService.createUser({
        name: nameArg,
        email: emailArg,
        password: passwordArg,
        role: 'admin',
        isVerified: true
      });
    } else {
      console.log(`👤 User already exists: ${emailArg}. Promoting to admin role.`);
      user.role = 'admin';
      await user.save();
    }

    console.log(`\n🎉 Success!`);
    console.log(`Email: ${emailArg}`);
    console.log(`Role:  ${user.role}`);
    console.log(`\nYou can now log in at ${process.env.CLIENT_URL}/login`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();
