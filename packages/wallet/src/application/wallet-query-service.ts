import { serializeWalletAmount } from '../domain/amount';
import {
  ARENA_POINT,
  type LedgerDirection,
  type LedgerTransactionType,
} from '../domain/wallet-types';
import type { Clock } from '../ports/clock';
import type { WalletRepository } from '../ports/wallet-repository';

export class WalletQueryService {
  public constructor(
    private readonly repository: WalletRepository,
    private readonly clock: Clock,
  ) {}
  public async getMine(userId: string) {
    const wallet = await this.repository.ensureWallet(userId, this.clock.now());
    return {
      id: wallet.id,
      status: wallet.status,
      asset: ARENA_POINT,
      balance: serializeWalletAmount(wallet.balance),
      updatedAt: wallet.updatedAt,
    };
  }
  public async listMine(
    userId: string,
    limit = 50,
    cursor?: string,
    type?: LedgerTransactionType,
    direction?: LedgerDirection,
  ) {
    return (
      await this.repository.listEntries(
        userId,
        Math.min(Math.max(limit, 1), 100),
        cursor,
        type,
        direction,
      )
    ).map((item) => ({
      ...item,
      amount: serializeWalletAmount(item.amount),
      balanceAfter: serializeWalletAmount(item.balanceAfter),
    }));
  }
}
