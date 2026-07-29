import { describe, expect, it } from 'vitest';
import { assertBalanced, nextBalance } from '../src/domain/ledger-policies';
import { WalletError } from '../src/domain/wallet-errors';

describe('double-entry policies', () => {
  it('requires equal positive debit and credit totals', () => {
    expect(() => {
      assertBalanced([
        { direction: 'DEBIT', amount: 4n },
        { direction: 'CREDIT', amount: 4n },
      ]);
    }).not.toThrow();
    expect(() => {
      assertBalanced([
        { direction: 'DEBIT', amount: 4n },
        { direction: 'CREDIT', amount: 3n },
      ]);
    }).toThrow(WalletError);
    expect(() => {
      assertBalanced([
        { direction: 'DEBIT', amount: 0n },
        { direction: 'CREDIT', amount: 0n },
      ]);
    }).toThrow(WalletError);
  });
  it('prevents a negative user balance but permits system account projections', () => {
    expect(nextBalance(10n, 'DEBIT', 4n)).toBe(6n);
    expect(nextBalance(0n, 'CREDIT', 4n)).toBe(4n);
    expect(() => {
      nextBalance(3n, 'DEBIT', 4n);
    }).toThrow(WalletError);
    expect(nextBalance(3n, 'DEBIT', 4n, false)).toBe(-1n);
  });
});
