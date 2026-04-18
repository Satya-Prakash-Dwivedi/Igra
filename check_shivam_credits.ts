import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './server/models/User';
import CreditWallet from './server/models/CreditWallet';

dotenv.config();

async function checkCredits() {
  await mongoose.connect(process.env.MONGODB_URI!);
  
  const user = await User.findOne({ name: /Shivam/i });
  if (!user) {
    console.log('User Shivam not found');
    process.exit(1);
  }
  
  const wallet = await CreditWallet.findOne({ userId: user._id });
  console.log('User:', user.name, '(', user._id, ')');
  console.log('Wallet Balance:', wallet ? wallet.balance : 'No Wallet Found');
  
  await mongoose.disconnect();
}

checkCredits();
