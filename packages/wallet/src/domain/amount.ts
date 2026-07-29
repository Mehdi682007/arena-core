import { WalletError } from './wallet-errors';

export const MAX_WALLET_AMOUNT = 1_000_000_000_000n;
export function parseWalletAmount(input: string): bigint {
  if (!/^[1-9][0-9]{0,12}$/.test(input)) throw new WalletError('WALLET_AMOUNT_INVALID');
  const value = BigInt(input);
  if (value > MAX_WALLET_AMOUNT) throw new WalletError('WALLET_AMOUNT_INVALID');
  return value;
}
export function serializeWalletAmount(value: bigint): string {
  return value.toString(10);
}
