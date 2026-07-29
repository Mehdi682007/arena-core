import type { ArenaPrismaClient } from '@arena-core/database';
import { toSettlementView } from '../domain/match-settlement-policies';
import type {
  MatchSettlementContext,
  MatchSettlementRecord,
} from '../domain/match-settlement-types';
import type {
  CreateMatchSettlementInput,
  MatchSettlementRepository,
} from '../ports/match-settlement-repository';
import type { PrismaMatchFinanceTransactionManager } from './prisma-match-finance-transaction-manager';

type Client = ArenaPrismaClient | ReturnType<PrismaMatchFinanceTransactionManager['current']>;
const settlementSelect = {
  id: true,
  matchId: true,
  status: true,
  type: true,
  assetCode: true,
  totalEscrowAmount: true,
  distributedAmount: true,
  refundedAmount: true,
  retainedAmount: true,
  winnerParticipantId: true,
  resultId: true,
  disputeId: true,
  idempotencyKey: true,
  requestFingerprint: true,
  settlementTransactionId: true,
  settledAt: true,
} as const;
function mapSettlement(value: unknown): MatchSettlementRecord {
  return value as MatchSettlementRecord;
}
export class PrismaMatchSettlementRepository implements MatchSettlementRepository {
  public constructor(
    private readonly source: ArenaPrismaClient | PrismaMatchFinanceTransactionManager,
  ) {}
  private client(): Client {
    return 'current' in this.source ? this.source.current() : this.source;
  }
  public async findSettlementContext(matchId: string): Promise<MatchSettlementContext | null> {
    const match = await this.client().match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        completedAt: true,
        settlementEligibleAt: true,
        result: {
          select: {
            id: true,
            status: true,
            version: true,
            winnerParticipantId: true,
            isDraw: true,
          },
        },
        disputes: {
          select: { id: true, status: true, resolvedAt: true },
          orderBy: { createdAt: 'desc' },
        },
        entryReservations: {
          select: {
            id: true,
            participantId: true,
            userId: true,
            ledgerAccountId: true,
            escrowAccountId: true,
            assetCode: true,
            amount: true,
            status: true,
          },
          orderBy: { participantId: 'asc' },
        },
        settlement: { select: { id: true } },
      },
    });
    if (!match) return null;
    const active = match.disputes.some((item) =>
      ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW'].includes(item.status),
    );
    const terminal = match.disputes.find((item) =>
      ['RESOLVED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(item.status),
    );
    const escrowAccountId = match.entryReservations.find(
      (item) => item.escrowAccountId,
    )?.escrowAccountId;
    const escrow = escrowAccountId
      ? await this.client().ledgerAccount.findUnique({
          where: { id: escrowAccountId },
          select: { currentBalance: true },
        })
      : null;
    return {
      matchId: match.id,
      matchStatus: match.status,
      completedAt: match.completedAt,
      settlementEligibleAt: match.settlementEligibleAt,
      resultId: match.result?.id ?? null,
      resultStatus: match.result?.status ?? null,
      resultVersion: match.result?.version ?? null,
      winnerParticipantId: match.result?.winnerParticipantId ?? null,
      isDraw: match.result?.isDraw ?? false,
      terminalDisputeId: terminal?.id ?? null,
      terminalDisputeResolvedAt: terminal?.resolvedAt ?? null,
      activeDispute: active,
      reservations: match.entryReservations,
      escrowBalance: escrow?.currentBalance ?? 0n,
      settlementExists: match.settlement !== null,
    };
  }
  public async findSettlementByMatchId(matchId: string) {
    const value = await this.client().matchSettlement.findUnique({
      where: { matchId },
      select: settlementSelect,
    });
    return value ? mapSettlement(value) : null;
  }
  public async findSettlementByIdempotencyKey(idempotencyKey: string) {
    const value = await this.client().matchSettlement.findUnique({
      where: { idempotencyKey },
      select: settlementSelect,
    });
    return value ? mapSettlement(value) : null;
  }
  public async createSettlement(input: CreateMatchSettlementInput) {
    const refund = input.type !== 'WINNER_TAKES_ALL';
    const settlement = await this.client().matchSettlement.create({
      data: {
        id: input.id,
        matchId: input.context.matchId,
        assetCode: 'ARENA_POINT',
        status: refund ? 'REFUNDED' : 'SETTLED',
        type: input.type,
        totalEscrowAmount: input.total,
        distributedAmount: refund ? 0n : input.total,
        refundedAmount: refund ? input.total : 0n,
        retainedAmount: 0n,
        winnerParticipantId:
          input.type === 'WINNER_TAKES_ALL' ? input.context.winnerParticipantId : null,
        resultId: input.context.resultId,
        disputeId: input.context.terminalDisputeId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.fingerprint,
        settlementTransactionId: input.transactionId,
        settledAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
      select: settlementSelect,
    });
    for (const reservation of input.context.reservations) {
      const outcome = input.outcomes.get(reservation.id);
      if (!outcome) throw new Error('Missing reservation outcome');
      await this.client().matchEntryReservation.update({
        where: { id: reservation.id },
        data: {
          status: refund ? 'REFUNDED' : 'SETTLED',
          settlementId: input.id,
          settlementOutcome: outcome,
          ...(refund ? { refundedAt: input.now } : {}),
          version: { increment: 1 },
        },
        select: { id: true },
      });
    }
    return mapSettlement(settlement);
  }
  public async getSettlementForUser(userId: string, matchId: string) {
    const reservation = await this.client().matchEntryReservation.findFirst({
      where: { userId, matchId, settlementId: { not: null } },
      select: {
        participantId: true,
        amount: true,
        settlement: { select: settlementSelect },
      },
    });
    if (!reservation?.settlement) return null;
    return {
      settlement: mapSettlement(reservation.settlement),
      participantId: reservation.participantId,
      ownAmount: reservation.amount,
    };
  }
  public async listSettlementsForUser(userId: string, limit: number) {
    const items = await this.client().matchEntryReservation.findMany({
      where: { userId, settlementId: { not: null } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        participantId: true,
        amount: true,
        settlement: { select: settlementSelect },
      },
    });
    return items.flatMap((item) =>
      item.settlement
        ? [toSettlementView(mapSettlement(item.settlement), item.participantId, item.amount)]
        : [],
    );
  }
  public async getSettlementForAdmin(matchId: string) {
    return this.findSettlementByMatchId(matchId);
  }
  public async listSettlementsForAdmin(limit: number) {
    return (
      await this.client().matchSettlement.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: settlementSelect,
      })
    ).map(mapSettlement);
  }
  public async listEligibleMatches(eligibleBefore: Date, limit: number) {
    return (
      await this.client().match.findMany({
        where: {
          settlement: null,
          status: { in: ['COMPLETED', 'VOIDED'] },
          OR: [
            { status: 'VOIDED' },
            { settlementEligibleAt: { lte: new Date() } },
            { status: 'COMPLETED', completedAt: { lte: eligibleBefore } },
          ],
          disputes: { none: { status: { in: ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW'] } } },
        },
        take: limit,
        orderBy: { settlementEligibleAt: 'asc' },
        select: { id: true },
      })
    ).map((item) => item.id);
  }
  public async listFailedSettlements(limit: number) {
    return (
      await this.client().matchSettlement.findMany({
        where: { status: 'FAILED' },
        take: limit,
        orderBy: { failedAt: 'asc' },
        select: settlementSelect,
      })
    ).map(mapSettlement);
  }
}
