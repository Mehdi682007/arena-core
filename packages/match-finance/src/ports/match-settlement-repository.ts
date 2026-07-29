import type {
  MatchEntrySettlementOutcome,
  MatchSettlementContext,
  MatchSettlementRecord,
  MatchSettlementType,
  MatchSettlementView,
} from '../domain/match-settlement-types';

export interface CreateMatchSettlementInput {
  readonly id: string;
  readonly context: MatchSettlementContext;
  readonly type: Exclude<MatchSettlementType, 'ADMIN_CORRECTION'>;
  readonly total: bigint;
  readonly transactionId: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly now: Date;
  readonly outcomes: ReadonlyMap<string, MatchEntrySettlementOutcome>;
}
export interface MatchSettlementRepository {
  findSettlementContext(matchId: string): Promise<MatchSettlementContext | null>;
  findSettlementByMatchId(matchId: string): Promise<MatchSettlementRecord | null>;
  findSettlementByIdempotencyKey(key: string): Promise<MatchSettlementRecord | null>;
  createSettlement(input: CreateMatchSettlementInput): Promise<MatchSettlementRecord>;
  getSettlementForUser(
    userId: string,
    matchId: string,
  ): Promise<{
    settlement: MatchSettlementRecord;
    participantId: string;
    ownAmount: bigint;
  } | null>;
  listSettlementsForUser(userId: string, limit: number): Promise<readonly MatchSettlementView[]>;
  getSettlementForAdmin(matchId: string): Promise<MatchSettlementRecord | null>;
  listSettlementsForAdmin(limit: number): Promise<readonly MatchSettlementRecord[]>;
  listEligibleMatches(eligibleBefore: Date, limit: number): Promise<readonly string[]>;
  listFailedSettlements(limit: number): Promise<readonly MatchSettlementRecord[]>;
}
