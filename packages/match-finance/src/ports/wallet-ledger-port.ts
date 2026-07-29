import type { MatchEscrowReconciliationResult } from '../domain/match-entry-types';

export interface ReserveLedgerInput {
  readonly matchId: string;
  readonly participantId: string;
  readonly userId: string;
  readonly amount: bigint;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly now: Date;
}
export interface RefundLedgerInput extends ReserveLedgerInput {
  readonly reservationId: string;
  readonly actorUserId: string;
}
export interface ReservationPosting {
  readonly walletId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly transactionId: string;
}
export interface WalletLedgerPort {
  reserve(input: ReserveLedgerInput): Promise<ReservationPosting>;
  refund(input: RefundLedgerInput): Promise<{ readonly transactionId: string }>;
  reconcileMatchEscrow(
    matchId: string,
    expectedBalance: bigint,
    reservationCount: number,
  ): Promise<MatchEscrowReconciliationResult>;
}
