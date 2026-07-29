import type {
  MatchEntryRequirementSnapshot,
  MatchEntryReservationRecord,
  MatchFinanceContext,
  MatchFinanceRefundReason,
} from '../domain/match-entry-types';

export interface CreateReservationInput {
  readonly id: string;
  readonly context: MatchFinanceContext;
  readonly requirement: MatchEntryRequirementSnapshot;
  readonly amount: bigint;
  readonly status: 'NOT_REQUIRED' | 'RESERVED';
  readonly walletId: string | null;
  readonly ledgerAccountId: string | null;
  readonly escrowAccountId: string | null;
  readonly ledgerTransactionId: string | null;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly now: Date;
  readonly expiresAt: Date;
}

export interface MatchFinanceRepository {
  findContext(userId: string, matchId: string): Promise<MatchFinanceContext | null>;
  findContextByParticipant(
    matchId: string,
    participantId: string,
  ): Promise<MatchFinanceContext | null>;
  listContexts(matchId: string): Promise<readonly MatchFinanceContext[]>;
  findByParticipant(
    matchId: string,
    participantId: string,
  ): Promise<MatchEntryReservationRecord | null>;
  findByIdempotencyKey(key: string): Promise<MatchEntryReservationRecord | null>;
  create(input: CreateReservationInput): Promise<MatchEntryReservationRecord>;
  findMine(userId: string, matchId: string): Promise<MatchEntryReservationRecord | null>;
  listMine(userId: string, limit: number): Promise<readonly MatchEntryReservationRecord[]>;
  listMatch(matchId: string, limit: number): Promise<readonly MatchEntryReservationRecord[]>;
  releaseMatch(matchId: string, now: Date): Promise<readonly MatchEntryReservationRecord[]>;
  markRefunded(
    reservationId: string,
    transactionId: string,
    reason: MatchFinanceRefundReason,
    actorUserId: string,
    now: Date,
  ): Promise<MatchEntryReservationRecord>;
  listRefundable(matchId: string, limit: number): Promise<readonly MatchEntryReservationRecord[]>;
  getMatchStatus(matchId: string): Promise<MatchFinanceContext['matchStatus'] | null>;
}
