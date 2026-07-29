import { describe, expect, it } from 'vitest';
import { parseWalletAmount, serializeWalletAmount } from '../src/domain/amount';
import { WalletError } from '../src/domain/wallet-errors';

describe('wallet amount', () => {
  it.each(['0', '-1', '1.1', '1e2', ' 1', '1 ', '', '10000000000000'])(
    'rejects non-canonical or out-of-range amount %j',
    (value) => {
      expect(() => parseWalletAmount(value)).toThrow(WalletError);
    },
  );
  it('parses and serializes without floating point', () => {
    expect(parseWalletAmount('999999999999')).toBe(999999999999n);
    expect(serializeWalletAmount(999999999999n)).toBe('999999999999');
  });
});
