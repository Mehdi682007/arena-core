import type { AdjustmentReason, LedgerDirection } from '../domain/wallet-types';
import type { WalletRepository } from '../ports/wallet-repository';
import { WalletLedgerService } from './wallet-ledger-service';

export class AdminWalletService {
  public constructor(
    private readonly repository: WalletRepository,
    private readonly ledger: WalletLedgerService,
  ) {}
  public get(userId: string) {
    return this.repository.getWallet(userId);
  }
  public issue(input: {
    userId: string;
    actorUserId: string;
    amount: bigint;
    idempotencyKey: string;
    reasonCode: AdjustmentReason;
    note?: string;
  }) {
    return this.ledger.post({ ...input, operation: 'ISSUANCE', direction: 'CREDIT' });
  }
  public adjust(input: {
    userId: string;
    actorUserId: string;
    direction: LedgerDirection;
    amount: bigint;
    idempotencyKey: string;
    reasonCode: AdjustmentReason;
    note?: string;
  }) {
    return this.ledger.post({ ...input, operation: 'ADMIN_ADJUSTMENT' });
  }
  public reverse(input: {
    transactionId: string;
    actorUserId: string;
    idempotencyKey: string;
    reasonCode: AdjustmentReason;
    note?: string;
  }) {
    return this.ledger.reverse(input);
  }
}
