import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User.js';
import * as userService from '../services/userService.js';
import * as creditService from '../services/creditService.js';
import logger from '../utils/logger.js';

// Fallback if .env is not present (standard in Docker containers)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function createTestUser() {
  const args = process.argv.slice(2);
  const emailArg = args.find(a => a.startsWith('--email='))?.split('=')[1] || 'test@igrastudios.com';
  const passwordArg = args.find(a => a.startsWith('--password='))?.split('=')[1] || 'Password123!';
  const creditsArg = parseInt(args.find(a => a.startsWith('--credits='))?.split('=')[1] || '5000');

  console.log(`🚀 Creating test account: ${emailArg} with ${creditsArg} credits...`);

  try {
    // 1. Connect to MongoDB (check process.env first)
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not found in environment. Check your Docker environment variables.');
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    // 2. Find or Create User
    let user = await User.findOne({ email: emailArg });
    if (!user) {
      console.log(`👤 User not found. Creating new user: ${emailArg}`);
      user = await userService.createUser({
        name: 'Test Account',
        email: emailArg,
        password: passwordArg,
      });
    } else {
      console.log(`👤 User already exists: ${emailArg}. Proceeding to grant credits.`);
    }

    // 3. Grant Credits via Wallet
    const wallet = await creditService.getOrCreateWallet(user._id);
    const idempotencyKey = `manual_grant_${Date.now()}`;

    // Note: We use any here because LedgerReason is an enum which might not have ADMIN_ADJUSTMENT yet
    await creditService.appendLedgerEntry({
      walletId: wallet._id,
      delta: creditsArg,
      reason: 'ADMIN_ADJUSTMENT' as any, 
      refType: 'ORDER' as any, 
      refId: user._id, 
      idempotencyKey,
    });

    const newBalance = await creditService.getBalance(user.id);
    console.log(`💰 Success! New balance for ${emailArg}: ${newBalance} credits.`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
}

createTestUser();
