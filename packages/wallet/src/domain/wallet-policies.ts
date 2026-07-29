import { createHash } from 'node:crypto';
import { WalletError } from './wallet-errors';
import type { AdjustmentReason, LedgerDirection, WalletStatus } from './wallet-types';

export function assertWalletWritable(status: WalletStatus): void {
  if (status === 'SUSPENDED') throw new WalletError('WALLET_SUSPENDED');
  if (status === 'CLOSED') throw new WalletError('WALLET_CLOSED');
}
export function validateIdempotencyKey(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value))
    throw new WalletError('WALLET_IDEMPOTENCY_CONFLICT');
  return value;
}
export function validateReason(reasonCode: AdjustmentReason, note?: string): void {
  if (
    !['FOUNDATION_TEST', 'PROMOTIONAL_GRANT', 'OPERATIONAL_CORRECTION', 'OTHER'].includes(
      reasonCode,
    )
  )
    throw new WalletError('WALLET_LEDGER_INVARIANT_VIOLATION');
  if ((reasonCode === 'OTHER' && !note?.trim()) || (note !== undefined && note.length > 500))
    throw new WalletError('WALLET_LEDGER_INVARIANT_VIOLATION');
}
export function requestFingerprint(value: {
  operation: string;
  userId: string;
  direction: LedgerDirection;
  amount: bigint;
  reasonCode: string;
  originalId?: string;
}): string {
  return createHash('sha256')
    .update(
      [
        value.operation,
        value.userId,
        value.direction,
        value.amount.toString(),
        value.reasonCode,
        value.originalId ?? '',
      ].join('\n'),
    )
    .digest('hex');
}
