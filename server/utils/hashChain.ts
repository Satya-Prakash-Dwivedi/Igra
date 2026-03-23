import crypto from 'crypto';

/**
 * Compute SHA-256 hash for a credit ledger entry.
 * Chain: each entry includes the hash of the previous entry.
 * This creates a tamper-evident append-only log.
 */
export function computeLedgerHash(
  walletId: string,
  delta: number,
  reason: string,
  idempotencyKey: string,
  balanceAfter: number,
  hashPrev: string
): string {
  const payload = `${walletId}|${delta}|${reason}|${idempotencyKey}|${balanceAfter}|${hashPrev}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
