import { WalletError } from '../domain/wallet-errors';
import {
  requestFingerprint,
  validateIdempotencyKey,
  validateReason,
} from '../domain/wallet-policies';
import type { AdjustmentReason, LedgerDirection } from '../domain/wallet-types';
import type { Clock } from '../ports/clock';
import type { WalletRepository } from '../ports/wallet-repository';

export class WalletLedgerService {
  public constructor(
    private readonly repository: WalletRepository,
    private readonly clock: Clock,
  ) {}
  public async post(input: {
    userId: string;
    actorUserId: string;
    operation: 'ISSUANCE' | 'ADMIN_ADJUSTMENT';
    direction: LedgerDirection;
    amount: bigint;
    idempotencyKey: string;
    reasonCode: AdjustmentReason;
    note?: string;
  }) {
    validateIdempotencyKey(input.idempotencyKey);
    validateReason(input.reasonCode, input.note);
    if (input.amount <= 0n) throw new WalletError('WALLET_AMOUNT_INVALID');
    if (input.operation === 'ISSUANCE' && input.direction !== 'CREDIT')
      throw new WalletError('WALLET_LEDGER_INVARIANT_VIOLATION');
    const fingerprint = requestFingerprint(input);
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new WalletError('WALLET_IDEMPOTENCY_CONFLICT');
      return existing;
    }
    return this.repository.post({
      ...input,
      type: input.operation,
      fingerprint,
      now: this.clock.now(),
    });
  }
  public async reverse(input: {
    transactionId: string;
    actorUserId: string;
    idempotencyKey: string;
    reasonCode: AdjustmentReason;
    note?: string;
  }) {
    validateIdempotencyKey(input.idempotencyKey);
    validateReason(input.reasonCode, input.note);
    const original = await this.repository.findTransaction(input.transactionId);
    if (!original) throw new WalletError('WALLET_TRANSACTION_NOT_FOUND');
    if (original.status !== 'POSTED' || original.type === 'REVERSAL')
      throw new WalletError('WALLET_TRANSACTION_NOT_REVERSIBLE');
    if (original.reversedById) throw new WalletError('WALLET_TRANSACTION_ALREADY_REVERSED');
    const fingerprint = requestFingerprint({
      operation: 'REVERSAL',
      userId: original.userId,
      direction: original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT',
      amount: original.amount,
      reasonCode: input.reasonCode,
      originalId: original.id,
    });
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new WalletError('WALLET_IDEMPOTENCY_CONFLICT');
      return existing;
    }
    return this.repository.reverse({
      ...input,
      fingerprint,
      now: this.clock.now(),
    });
  }
}
