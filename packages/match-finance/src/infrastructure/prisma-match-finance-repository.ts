import { Prisma, type ArenaPrismaClient } from '@arena-core/database';
import { MatchFinanceError } from '../domain/match-entry-errors';
import type {
  MatchEntryRequirementSnapshot,
  MatchEntryReservationRecord,
  MatchEntryReservationSnapshot,
  MatchFinanceContext,
  MatchFinanceRefundReason,
} from '../domain/match-entry-types';
import type {
  CreateReservationInput,
  MatchFinanceRepository,
} from '../ports/match-finance-repository';
import type { PrismaMatchFinanceTransactionManager } from './prisma-match-finance-transaction-manager';

type Client = ArenaPrismaClient | ReturnType<PrismaMatchFinanceTransactionManager['current']>;

const reservationSelect = {
  id: true,
  matchId: true,
  participantId: true,
  userId: true,
  assetCode: true,
  amount: true,
  status: true,
  requirementSnapshot: true,
  reservationSnapshot: true,
  ledgerTransactionId: true,
  refundLedgerTransactionId: true,
  idempotencyKey: true,
  requestFingerprint: true,
  reservedAt: true,
  releasedAt: true,
  refundedAt: true,
  expiresAt: true,
  version: true,
  createdAt: true,
} as const;

type ReservationRow = {
  id: string;
  matchId: string;
  participantId: string;
  userId: string;
  assetCode: string;
  amount: bigint;
  status: MatchEntryReservationRecord['status'];
  requirementSnapshot: unknown;
  reservationSnapshot: unknown;
  ledgerTransactionId: string | null;
  refundLedgerTransactionId: string | null;
  idempotencyKey: string;
  requestFingerprint: string;
  reservedAt: Date | null;
  releasedAt: Date | null;
  refundedAt: Date | null;
  expiresAt: Date;
  version: number;
  createdAt: Date;
};

function map(row: ReservationRow): MatchEntryReservationRecord {
  if (row.assetCode !== 'ARENA_POINT')
    throw new MatchFinanceError('MATCH_ESCROW_INVARIANT_VIOLATION');
  return {
    ...row,
    assetCode: 'ARENA_POINT',
    requirementSnapshot: row.requirementSnapshot as MatchEntryRequirementSnapshot,
    reservationSnapshot: row.reservationSnapshot as MatchEntryReservationSnapshot,
  };
}

export class PrismaMatchFinanceRepository implements MatchFinanceRepository {
  public constructor(
    private readonly source: ArenaPrismaClient | PrismaMatchFinanceTransactionManager,
  ) {}
  private client(): Client {
    return 'current' in this.source ? this.source.current() : this.source;
  }
  public async findContext(userId: string, matchId: string): Promise<MatchFinanceContext | null> {
    const row = await this.client().match.findFirst({
      where: { id: matchId, participants: { some: { userId } } },
      select: {
        id: true,
        status: true,
        rulesetSnapshot: true,
        readyDeadlineAt: true,
        participants: {
          where: { userId },
          select: { id: true, side: true, status: true, userId: true },
          take: 1,
        },
      },
    });
    const participant = row?.participants[0];
    if (!row || !participant) return null;
    const envelope = row.rulesetSnapshot as { data?: { configuration?: unknown } };
    return {
      matchId: row.id,
      matchStatus: row.status,
      participantId: participant.id,
      participantSide: participant.side,
      participantStatus: participant.status,
      userId: participant.userId,
      rulesetConfiguration: envelope.data?.configuration,
      readyDeadlineAt: row.readyDeadlineAt,
    };
  }
  public async findContextByParticipant(
    matchId: string,
    participantId: string,
  ): Promise<MatchFinanceContext | null> {
    const contexts = await this.listContexts(matchId);
    return contexts.find((context) => context.participantId === participantId) ?? null;
  }
  public async listContexts(matchId: string): Promise<readonly MatchFinanceContext[]> {
    const row = await this.client().match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        rulesetSnapshot: true,
        readyDeadlineAt: true,
        participants: {
          select: { id: true, side: true, status: true, userId: true },
          orderBy: { side: 'asc' },
        },
      },
    });
    if (!row) return [];
    const envelope = row.rulesetSnapshot as { data?: { configuration?: unknown } };
    return row.participants.map((participant) => ({
      matchId: row.id,
      matchStatus: row.status,
      participantId: participant.id,
      participantSide: participant.side,
      participantStatus: participant.status,
      userId: participant.userId,
      rulesetConfiguration: envelope.data?.configuration,
      readyDeadlineAt: row.readyDeadlineAt,
    }));
  }
  public findByParticipant(matchId: string, participantId: string) {
    return this.client()
      .matchEntryReservation.findUnique({
        where: { matchId_participantId: { matchId, participantId } },
        select: reservationSelect,
      })
      .then((row) => (row ? map(row) : null));
  }
  public findByIdempotencyKey(key: string) {
    return this.client()
      .matchEntryReservation.findUnique({
        where: { idempotencyKey: key },
        select: reservationSelect,
      })
      .then((row) => (row ? map(row) : null));
  }
  public create(input: CreateReservationInput) {
    const reservationSnapshot: MatchEntryReservationSnapshot = {
      schemaVersion: 1,
      assetCode: 'ARENA_POINT',
      amount: input.amount.toString(),
      required: input.requirement.required,
      matchId: input.context.matchId,
      participantSide: input.context.participantSide,
    };
    return this.client()
      .matchEntryReservation.create({
        data: {
          id: input.id,
          matchId: input.context.matchId,
          participantId: input.context.participantId,
          userId: input.context.userId,
          walletId: input.walletId,
          ledgerAccountId: input.ledgerAccountId,
          escrowAccountId: input.escrowAccountId,
          assetCode: 'ARENA_POINT',
          amount: input.amount,
          status: input.status,
          requirementSnapshot: input.requirement as unknown as Prisma.InputJsonValue,
          reservationSnapshot: reservationSnapshot as unknown as Prisma.InputJsonValue,
          ledgerTransactionId: input.ledgerTransactionId,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          reservedAt: input.status === 'RESERVED' ? input.now : null,
          expiresAt: input.expiresAt,
          createdAt: input.now,
          updatedAt: input.now,
        },
        select: reservationSelect,
      })
      .then(map)
      .catch(() => {
        throw new MatchFinanceError('MATCH_FINANCE_PERSISTENCE_FAILURE');
      });
  }
  public findMine(userId: string, matchId: string) {
    return this.client()
      .matchEntryReservation.findFirst({ where: { userId, matchId }, select: reservationSelect })
      .then((row) => (row ? map(row) : null));
  }
  public listMine(userId: string, limit: number) {
    return this.client()
      .matchEntryReservation.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: reservationSelect,
      })
      .then((rows) => rows.map(map));
  }
  public listMatch(matchId: string, limit: number) {
    return this.client()
      .matchEntryReservation.findMany({
        where: { matchId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
        select: reservationSelect,
      })
      .then((rows) => rows.map(map));
  }
  public async releaseMatch(matchId: string, now: Date) {
    await this.client().matchEntryReservation.updateMany({
      where: { matchId, status: 'RESERVED' },
      data: { status: 'RELEASED', releasedAt: now, version: { increment: 1 } },
    });
    return this.listMatch(matchId, 100);
  }
  public markRefunded(
    reservationId: string,
    transactionId: string,
    _reason: MatchFinanceRefundReason,
    _actorUserId: string,
    now: Date,
  ) {
    return this.client()
      .matchEntryReservation.update({
        where: { id: reservationId, status: 'RESERVED' },
        data: {
          status: 'REFUNDED',
          refundLedgerTransactionId: transactionId,
          refundedAt: now,
          version: { increment: 1 },
        },
        select: reservationSelect,
      })
      .then(map);
  }
  public listRefundable(matchId: string, limit: number) {
    return this.client()
      .matchEntryReservation.findMany({
        where: { matchId, status: 'RESERVED' },
        take: limit,
        orderBy: { id: 'asc' },
        select: reservationSelect,
      })
      .then((rows) => rows.map(map));
  }
  public async getMatchStatus(matchId: string): Promise<MatchFinanceContext['matchStatus'] | null> {
    return (
      (await this.client().match.findUnique({ where: { id: matchId }, select: { status: true } }))
        ?.status ?? null
    );
  }
}
