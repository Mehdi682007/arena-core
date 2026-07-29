import { MatchSettlementError } from '../domain/match-settlement-errors';
import {
  evaluateMatchSettlementEligibility,
  settlementFingerprint,
  toSettlementView,
} from '../domain/match-settlement-policies';
import type {
  MatchEntrySettlementOutcome,
  MatchSettlementRecord,
  MatchSettlementView,
} from '../domain/match-settlement-types';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { MatchFinanceTransactionManager } from '../ports/match-finance-transaction-manager';
import type { MatchSettlementLedgerPort } from '../ports/match-settlement-ledger-port';
import type { MatchSettlementRepository } from '../ports/match-settlement-repository';

export class MatchSettlementService {
  public constructor(
    private readonly repository: MatchSettlementRepository,
    private readonly ledger: MatchSettlementLedgerPort,
    private readonly transactions: MatchFinanceTransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly delaySeconds = 86_400,
    private readonly integration?: { settlementCompleted(settlementId: string): Promise<void> },
  ) {}
  public async settle(input: {
    matchId: string;
    idempotencyKey: string;
    actorUserId: string;
    operation: 'SYSTEM' | 'ADMIN_RETRY';
  }): Promise<MatchSettlementRecord> {
    const settlement = await this.transactions.transaction(async () => {
      const context = await this.repository.findSettlementContext(input.matchId);
      if (!context) throw new MatchSettlementError('MATCH_SETTLEMENT_NOT_FOUND');
      const now = this.clock.now();
      const effectiveContext =
        context.settlementEligibleAt || !context.completedAt
          ? context
          : {
              ...context,
              settlementEligibleAt:
                context.resultStatus === 'ADMIN_RESOLVED' && context.terminalDisputeResolvedAt
                  ? context.terminalDisputeResolvedAt
                  : new Date(context.completedAt.getTime() + this.delaySeconds * 1000),
            };
      const eligibility = evaluateMatchSettlementEligibility(effectiveContext, now);
      const total = context.reservations.reduce((sum, item) => sum + item.amount, 0n);
      const fingerprint = settlementFingerprint({
        matchId: context.matchId,
        resultId: context.resultId,
        resultVersion: context.resultVersion,
        type: eligibility.type ?? 'INELIGIBLE',
        total,
      });
      const keyed = await this.repository.findSettlementByIdempotencyKey(input.idempotencyKey);
      if (keyed) {
        if (keyed.requestFingerprint !== fingerprint)
          throw new MatchSettlementError('MATCH_SETTLEMENT_IDEMPOTENCY_CONFLICT');
        return keyed;
      }
      const existing = await this.repository.findSettlementByMatchId(input.matchId);
      if (existing) throw new MatchSettlementError('MATCH_SETTLEMENT_ALREADY_EXISTS');
      if (!eligibility.eligible || !eligibility.type) {
        if (eligibility.reasons.includes('ACTIVE_DISPUTE_EXISTS'))
          throw new MatchSettlementError('MATCH_SETTLEMENT_ACTIVE_DISPUTE');
        if (eligibility.reasons.includes('SETTLEMENT_DELAY_NOT_ELAPSED'))
          throw new MatchSettlementError('MATCH_SETTLEMENT_DELAY_NOT_ELAPSED');
        if (eligibility.reasons.includes('ESCROW_BALANCE_MISMATCH'))
          throw new MatchSettlementError('MATCH_SETTLEMENT_ESCROW_MISMATCH');
        throw new MatchSettlementError('MATCH_SETTLEMENT_NOT_ELIGIBLE');
      }
      const posting = await this.ledger.postSettlement({
        matchId: input.matchId,
        type: eligibility.type,
        winnerParticipantId: context.winnerParticipantId,
        reservations: context.reservations,
        idempotencyKey: `ledger:${input.idempotencyKey}`,
        fingerprint,
        actorUserId: input.actorUserId,
        now,
      });
      const outcomes = new Map<string, MatchEntrySettlementOutcome>();
      for (const reservation of context.reservations) {
        outcomes.set(
          reservation.id,
          eligibility.type === 'WINNER_TAKES_ALL'
            ? reservation.participantId === context.winnerParticipantId
              ? 'WINNER_CREDITED'
              : 'LOSER_CONTRIBUTED'
            : eligibility.type === 'DRAW_REFUND'
              ? 'DRAW_REFUNDED'
              : 'VOID_REFUNDED',
        );
      }
      return this.repository.createSettlement({
        id: this.ids.generate(),
        context,
        type: eligibility.type,
        total,
        transactionId: posting.transactionId,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        now,
        outcomes,
      });
    });
    await this.integration?.settlementCompleted(settlement.id);
    return settlement;
  }
  public async getMine(userId: string, matchId: string): Promise<MatchSettlementView> {
    const item = await this.repository.getSettlementForUser(userId, matchId);
    if (!item) throw new MatchSettlementError('MATCH_SETTLEMENT_NOT_FOUND');
    return toSettlementView(item.settlement, item.participantId, item.ownAmount);
  }
  public listMine(userId: string, limit = 50): Promise<readonly MatchSettlementView[]> {
    return this.repository.listSettlementsForUser(userId, Math.min(Math.max(limit, 1), 100));
  }
}
