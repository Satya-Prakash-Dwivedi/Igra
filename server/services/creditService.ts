import mongoose from 'mongoose';
import CreditWallet from '../models/CreditWallet.js';
import CreditLedgerEntry, { LedgerReason, LedgerRefType } from '../models/CreditLedgerEntry.js';
import { computeLedgerHash } from '../utils/hashChain.js';

interface AppendLedgerOpts {
  walletId: mongoose.Types.ObjectId | string;
  delta: number;
  reason: LedgerReason;
  refType: LedgerRefType;
  refId: mongoose.Types.ObjectId | string;
  idempotencyKey: string;
}

/**
 * Append an idempotent, hash-chained entry to the credit ledger.
 * Debit (negative delta) will fail if balance insufficient.
 * Returns the entry (existing if idempotency key already used).
 */
export async function appendLedgerEntry(opts: AppendLedgerOpts) {
  // 1. Idempotency check — return existing if already processed
  const existing = await CreditLedgerEntry.findOne({ idempotencyKey: opts.idempotencyKey });
  if (existing) return existing;

  // 2. Get wallet + compute new balance
  const wallet = await CreditWallet.findById(opts.walletId);
  if (!wallet) throw new Error('Credit wallet not found');

  const newBalance = wallet.balance + opts.delta;
  if (newBalance < 0) {
    throw new Error(`Insufficient credits. Have: ${wallet.balance}, need: ${Math.abs(opts.delta)}`);
  }

  // 3. Get previous hash for chain
  const lastEntry = await CreditLedgerEntry.findOne({ walletId: opts.walletId }).sort({ createdAt: -1 });
  const hashPrev = lastEntry?.hashSelf || '';

  // 4. Compute hash
  const hashSelf = computeLedgerHash(
    opts.walletId.toString(),
    opts.delta,
    opts.reason,
    opts.idempotencyKey,
    newBalance,
    hashPrev
  );

  // 5. Atomic: create entry + update wallet in a transaction
  const session = await mongoose.startSession();
  const useTransactions = process.env.NODE_ENV !== 'development' && process.env.MONGO_DISABLE_TRANSACTIONS !== 'true';
  
  if (useTransactions) {
    session.startTransaction();
  }

  try {
    const [entry] = await CreditLedgerEntry.create(
      [{
        walletId: opts.walletId,
        delta: opts.delta,
        reason: opts.reason,
        refType: opts.refType,
        refId: opts.refId,
        idempotencyKey: opts.idempotencyKey,
        hashPrev,
        hashSelf,
        balanceAfter: newBalance,
      }],
      { session }
    );

    await CreditWallet.findByIdAndUpdate(
      opts.walletId,
      { balance: newBalance },
      { session }
    );

    if (useTransactions) {
      await session.commitTransaction();
    }
    return entry;
  } catch (err) {
    if (useTransactions) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Get or create a credit wallet for a user.
 */
export async function getOrCreateWallet(userId: string | mongoose.Types.ObjectId) {
  let wallet = await CreditWallet.findOne({ userId });
  if (!wallet) {
    wallet = await CreditWallet.create({ userId, balance: 0 });
  }
  return wallet;
}

/**
 * Get wallet balance for a user.
 */
export async function getBalance(userId: string) {
  const wallet = await getOrCreateWallet(userId);
  return wallet.balance;
}

/**
 * Get ledger entries for a wallet (paginated).
 */
export async function getLedgerEntries(userId: string, page = 1, limit = 20) {
  const wallet = await getOrCreateWallet(userId);
  const entries = await CreditLedgerEntry.find({ walletId: wallet._id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const total = await CreditLedgerEntry.countDocuments({ walletId: wallet._id });
  return { entries, total, page, limit };
}
