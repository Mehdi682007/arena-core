import { Buffer } from 'node:buffer';
import type { ArenaPrismaClient } from '@arena-core/database';
import { Prisma } from '@arena-core/database';
import { AdminOperationError } from '../domain/admin-operation-errors';
import type { AdminSearchScope, AuditEvent, AuditQuery, TimelineItem } from '../domain/audit-types';
import type {
  AdminOperationRepository,
  AppendAuditInput,
} from '../ports/admin-operation-repository';

type Cursor = { createdAt: string; id: string };
const auditSelect = {
  id: true,
  actorUserId: true,
  actorType: true,
  action: true,
  targetType: true,
  targetId: true,
  source: true,
  metadata: true,
  createdAt: true,
} as const;
const encodeCursor = (value: Cursor) =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (!parsed.id || Number.isNaN(Date.parse(parsed.createdAt))) throw new Error('invalid');
    return parsed;
  } catch {
    throw new AdminOperationError('ADMIN_AUDIT_INVALID');
  }
}
const mapAudit = (row: Record<string, unknown> | null) =>
  row ? (row as unknown as AuditEvent) : null;
const sortTimeline = (items: TimelineItem[], limit: number) =>
  items
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, limit);

export class PrismaAdminOperationRepository implements AdminOperationRepository {
  public constructor(private readonly client: ArenaPrismaClient) {}
  public async append(input: AppendAuditInput): Promise<AuditEvent> {
    return mapAudit(
      await this.client.adminAuditEvent.create({
        data: { ...input, metadata: input.metadata as Prisma.InputJsonValue },
        select: auditSelect,
      }),
    ) as AuditEvent;
  }
  public async findAudit(id: string) {
    return mapAudit(
      await this.client.adminAuditEvent.findUnique({ where: { id }, select: auditSelect }),
    );
  }
  public async queryAudit(query: AuditQuery) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const rows = await this.client.adminAuditEvent.findMany({
      where: {
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.targetId ? { targetId: query.targetId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.createdFrom || query.createdTo
          ? {
              createdAt: {
                ...(query.createdFrom ? { gte: query.createdFrom } : {}),
                ...(query.createdTo ? { lte: query.createdTo } : {}),
              },
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: auditSelect,
    });
    const items = rows.slice(0, query.limit).map((row) => mapAudit(row) as AuditEvent);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }
  public async search(
    scope: AdminSearchScope,
    term: string,
    limit: number,
  ): Promise<readonly Readonly<Record<string, unknown>>[]> {
    switch (scope) {
      case 'USER':
        return await this.client.user.findMany({
          where: {
            OR: [
              { id: this.uuid(term) },
              { status: this.enumValue(USER_STATUSES, term) as never },
              { emails: { some: { normalizedEmail: { contains: term.toLowerCase() } } } },
            ].filter(Boolean) as Prisma.UserWhereInput[],
          },
          select: { id: true, status: true, createdAt: true },
          take: limit,
        });
      case 'GAME_ACCOUNT':
        return await this.client.userGameAccount.findMany({
          where: {
            OR: [
              { id: this.uuid(term) },
              { normalizedHandle: { contains: term.toLowerCase() } },
              { game: { key: { contains: term.toLowerCase() } } },
              { gamePlatform: { platform: { key: { contains: term.toLowerCase() } } } },
            ].filter(Boolean) as Prisma.UserGameAccountWhereInput[],
          },
          select: {
            id: true,
            userId: true,
            displayHandle: true,
            status: true,
            game: { select: { key: true } },
            gamePlatform: { select: { platform: { select: { key: true } } } },
            createdAt: true,
          },
          take: limit,
        });
      case 'MATCH':
        return await this.client.match.findMany({
          where: {
            OR: [
              { id: this.uuid(term) },
              { status: this.enumValue(MATCH_STATUSES, term) as never },
            ].filter(Boolean) as Prisma.MatchWhereInput[],
          },
          select: {
            id: true,
            status: true,
            game: { select: { key: true } },
            gameMode: { select: { key: true } },
            createdAt: true,
          },
          take: limit,
        });
      case 'NOTIFICATION':
        return await this.client.notification.findMany({
          where: {
            OR: [
              { id: this.uuid(term) },
              { type: this.enumValue(NOTIFICATION_TYPES, term) as never },
              {
                outboxMessages: {
                  some: { status: this.enumValue(NOTIFICATION_STATUSES, term) as never },
                },
              },
            ].filter(Boolean) as Prisma.NotificationWhereInput[],
          },
          select: {
            id: true,
            recipientUserId: true,
            type: true,
            createdAt: true,
            outboxMessages: { select: { channel: true, status: true } },
          },
          take: limit,
        });
      case 'WALLET':
        return await this.client.ledgerTransaction.findMany({
          where: {
            OR: [
              { id: this.uuid(term) },
              { createdByUserId: this.uuid(term) },
              { type: this.enumValue(LEDGER_TYPES, term) as never },
            ].filter(Boolean) as Prisma.LedgerTransactionWhereInput[],
          },
          select: { id: true, createdByUserId: true, type: true, status: true, createdAt: true },
          take: limit,
        });
      case 'RATING':
        return await this.client.playerRating.findMany({
          where: {
            OR: [
              { userId: this.uuid(term) },
              { game: { key: { contains: term.toLowerCase() } } },
              { gameMode: { key: { contains: term.toLowerCase() } } },
            ].filter(Boolean) as Prisma.PlayerRatingWhereInput[],
          },
          select: {
            id: true,
            userId: true,
            rating: true,
            matchesPlayed: true,
            game: { select: { key: true } },
            gameMode: { select: { key: true } },
            updatedAt: true,
          },
          take: limit,
        });
    }
  }
  public async userTimeline(userId: string, limit: number) {
    const [user, accounts, matches, notifications, wallet, ratings, audit] = await Promise.all([
      this.client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          emails: { select: { verifiedAt: true } },
        },
      }),
      this.client.userGameAccount.findMany({
        where: { userId },
        select: { id: true, status: true, displayHandle: true, createdAt: true, updatedAt: true },
      }),
      this.client.matchParticipant.findMany({
        where: { userId },
        select: { id: true, matchId: true, status: true, createdAt: true, readyAt: true },
      }),
      this.client.notification.findMany({
        where: { recipientUserId: userId },
        select: { id: true, type: true, createdAt: true },
        take: limit,
      }),
      this.client.walletAuditEvent.findMany({
        where: { wallet: { userId } },
        select: { id: true, action: true, createdAt: true },
        take: limit,
      }),
      this.client.playerRatingChange.findMany({
        where: { userId },
        select: {
          id: true,
          matchId: true,
          outcome: true,
          ratingBefore: true,
          ratingAfter: true,
          appliedAt: true,
        },
        take: limit,
      }),
      this.client.adminAuditEvent.findMany({
        where: { OR: [{ actorUserId: userId }, { targetType: 'USER', targetId: userId }] },
        select: auditSelect,
        take: limit,
      }),
    ]);
    const items: TimelineItem[] = [];
    if (user)
      items.push({
        id: user.id,
        type: 'USER_REGISTERED',
        occurredAt: user.createdAt,
        summary: 'User registered',
        data: { status: user.status },
      });
    for (const [i, row] of (user?.emails ?? []).entries())
      if (row.verifiedAt)
        items.push({
          id: `${userId}:email:${String(i)}`,
          type: 'EMAIL_VERIFIED',
          occurredAt: row.verifiedAt,
          summary: 'Email verified',
          data: {},
        });
    for (const row of accounts)
      items.push({
        id: row.id,
        type: 'GAME_ACCOUNT',
        occurredAt: row.updatedAt,
        summary: 'Game account state',
        data: { status: row.status, displayHandle: row.displayHandle },
      });
    for (const row of matches)
      items.push({
        id: row.id,
        type: 'MATCH_PARTICIPATION',
        occurredAt: row.readyAt ?? row.createdAt,
        summary: 'Match participation',
        data: { matchId: row.matchId, status: row.status },
      });
    for (const row of notifications)
      items.push({
        id: row.id,
        type: 'NOTIFICATION',
        occurredAt: row.createdAt,
        summary: 'Notification created',
        data: { notificationType: row.type },
      });
    for (const row of wallet)
      items.push({
        id: row.id,
        type: 'WALLET_EVENT',
        occurredAt: row.createdAt,
        summary: 'Wallet event',
        data: { action: row.action },
      });
    for (const row of ratings)
      items.push({
        id: row.id,
        type: 'RATING_EVENT',
        occurredAt: row.appliedAt,
        summary: 'Rating changed',
        data: {
          matchId: row.matchId,
          outcome: row.outcome,
          ratingBefore: row.ratingBefore,
          ratingAfter: row.ratingAfter,
        },
      });
    for (const row of audit)
      items.push({
        id: row.id,
        type: 'ADMIN_AUDIT',
        occurredAt: row.createdAt,
        summary: row.action,
        data: { targetType: row.targetType, targetId: row.targetId },
      });
    return sortTimeline(items, limit);
  }
  public async matchTimeline(matchId: string, limit: number) {
    const [match, events, result, disputes, settlement, rating, audit] = await Promise.all([
      this.client.match.findUnique({
        where: { id: matchId },
        select: { id: true, status: true, createdAt: true },
      }),
      this.client.matchAuditEvent.findMany({
        where: { matchId },
        select: { id: true, action: true, reasonCode: true, createdAt: true },
      }),
      this.client.matchResult.findUnique({
        where: { matchId },
        select: { id: true, status: true, isDraw: true, createdAt: true, confirmedAt: true },
      }),
      this.client.matchDispute.findMany({
        where: { matchId },
        select: { id: true, status: true, reasonCode: true, createdAt: true, resolvedAt: true },
      }),
      this.client.matchSettlement.findUnique({
        where: { matchId },
        select: { id: true, status: true, type: true, createdAt: true, settledAt: true },
      }),
      this.client.matchRatingApplication.findUnique({
        where: { matchId },
        select: { id: true, status: true, createdAt: true, appliedAt: true },
      }),
      this.client.adminAuditEvent.findMany({
        where: { targetType: 'MATCH', targetId: matchId },
        select: auditSelect,
      }),
    ]);
    const items: TimelineItem[] = [];
    if (match)
      items.push({
        id: match.id,
        type: 'MATCH_CREATED',
        occurredAt: match.createdAt,
        summary: 'Match created',
        data: { status: match.status },
      });
    for (const row of events)
      items.push({
        id: row.id,
        type: 'MATCH_EVENT',
        occurredAt: row.createdAt,
        summary: row.action,
        data: { reasonCode: row.reasonCode },
      });
    if (result)
      items.push({
        id: result.id,
        type: 'MATCH_RESULT',
        occurredAt: result.confirmedAt ?? result.createdAt,
        summary: 'Match result',
        data: { status: result.status, isDraw: result.isDraw },
      });
    for (const row of disputes)
      items.push({
        id: row.id,
        type: 'MATCH_DISPUTE',
        occurredAt: row.resolvedAt ?? row.createdAt,
        summary: 'Match dispute',
        data: { status: row.status, reasonCode: row.reasonCode },
      });
    if (settlement)
      items.push({
        id: settlement.id,
        type: 'MATCH_SETTLEMENT',
        occurredAt: settlement.settledAt ?? settlement.createdAt,
        summary: 'Match settlement',
        data: { status: settlement.status, settlementType: settlement.type },
      });
    if (rating)
      items.push({
        id: rating.id,
        type: 'MATCH_RATING',
        occurredAt: rating.appliedAt ?? rating.createdAt,
        summary: 'Match rating application',
        data: { status: rating.status },
      });
    for (const row of audit)
      items.push({
        id: row.id,
        type: 'ADMIN_AUDIT',
        occurredAt: row.createdAt,
        summary: row.action,
        data: { targetType: row.targetType },
      });
    return sortTimeline(items, limit);
  }
  private uuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? value
      : undefined;
  }
  private enumValue(values: readonly string[], value: string): string | undefined {
    const upper = value.toUpperCase();
    return values.includes(upper) ? upper : undefined;
  }
}

const USER_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'DELETED'];
const MATCH_STATUSES = [
  'CREATED',
  'AWAITING_READY',
  'READY',
  'IN_PROGRESS',
  'AWAITING_RESULT',
  'RESULT_CONFLICT',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'VOIDED',
];
const NOTIFICATION_TYPES = [
  'MATCHMAKING_PROPOSAL_CREATED',
  'MATCHMAKING_PROPOSAL_ACCEPTED',
  'MATCH_READY_REQUIRED',
  'MATCH_STARTED',
  'MATCH_RESULT_WAITING',
  'MATCH_RESULT_CONFIRMED',
  'MATCH_RESULT_CONFLICT',
  'MATCH_DISPUTE_OPENED',
  'MATCH_DISPUTE_RESPONSE_RECEIVED',
  'MATCH_DISPUTE_RESOLVED',
  'MATCH_SETTLEMENT_COMPLETED',
  'RATING_UPDATED',
  'SECURITY_SIGN_IN',
];
const NOTIFICATION_STATUSES = [
  'PENDING',
  'PROCESSING',
  'DELIVERED',
  'RETRY_SCHEDULED',
  'FAILED',
  'DEAD_LETTERED',
  'CANCELLED',
];
const LEDGER_TYPES = [
  'ISSUANCE',
  'ADMIN_ADJUSTMENT',
  'REVERSAL',
  'MATCH_ENTRY_RESERVATION',
  'MATCH_ENTRY_REFUND',
  'MATCH_WINNER_SETTLEMENT',
  'MATCH_DRAW_REFUND',
  'MATCH_VOID_REFUND',
];
