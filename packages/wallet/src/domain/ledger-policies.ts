import { WalletError } from './wallet-errors';
import type { LedgerDirection } from './wallet-types';

export function nextBalance(
  current: bigint,
  direction: LedgerDirection,
  amount: bigint,
  userAccount = true,
): bigint {
  if (amount <= 0n) throw new WalletError('WALLET_AMOUNT_INVALID');
  const next = direction === 'CREDIT' ? current + amount : current - amount;
  if (userAccount && next < 0n) throw new WalletError('WALLET_INSUFFICIENT_BALANCE');
  return next;
}
export function assertBalanced(
  entries: readonly { direction: LedgerDirection; amount: bigint }[],
): void {
  if (entries.length < 2) throw new WalletError('WALLET_LEDGER_INVARIANT_VIOLATION');
  const debit = entries
    .filter((entry) => entry.direction === 'DEBIT')
    .reduce((sum, entry) => sum + entry.amount, 0n);
  const credit = entries
    .filter((entry) => entry.direction === 'CREDIT')
    .reduce((sum, entry) => sum + entry.amount, 0n);
  if (debit !== credit || debit <= 0n) throw new WalletError('WALLET_LEDGER_INVARIANT_VIOLATION');
}
