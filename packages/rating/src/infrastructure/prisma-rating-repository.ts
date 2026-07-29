import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { RatingError } from '../domain/rating-errors';
import type { LeaderboardPage, LeaderboardQuery, RatingScope } from '../domain/leaderboard-types';
import type {
  MatchRatingApplicationRecord,
  MatchRatingContext,
  MyRatingView,
  PlayerRatingRecord,
  RatingChangeRecord,
  RatingHistoryItemView,
} from '../domain/rating-types';
import type {
  EnsurePlayerRatingInput,
  PersistRatingApplicationInput,
  RatingRepository,
} from '../ports/rating-repository';

type Client = ArenaPrismaClient | Prisma.TransactionClient;

const ratingSelect = {
  id: true,
  userId: true,
  gameId: true,
  gameModeId: true,
  crossplayGroupId: true,
  policyKey: true,
  policyVersion: true,
  rating: true,
  matchesPlayed: true,
  wins: true,
  losses: true,
  draws: true,
  provisionalMatchesPlayed: true,
  highestRating: true,
  lowestRating: true,
  lastMatchId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlayerRatingSelect;
const applicationSelect = {
  id: true,
  matchId: true,
  matchResultId: true,
  status: true,
  policyKey: true,
  policyVersion: true,
  idempotencyKey: true,
  requestFingerprint: true,
  actorUserId: true,
  appliedAt: true,
  failedAt: true,
  failureCode: true,
  version: true,
} satisfies Prisma.MatchRatingApplicationSelect;
const changeSelect = {
  id: true,
  playerRatingId: true,
  matchId: true,
  matchResultId: true,
  userId: true,
  opponentUserId: true,
  outcome: true,
  ratingBefore: true,
  ratingAfter: true,
  ratingDelta: true,
  opponentRatingBefore: true,
  policyKey: true,
  policyVersion: true,
  calculationSnapshot: true,
  appliedAt: true,
  reversedAt: true,
  version: true,
  createdAt: true,
} satisfies Prisma.PlayerRatingChangeSelect;

type RatingRow = Prisma.PlayerRatingGetPayload<{ select: typeof ratingSelect }>;
type ApplicationRow = Prisma.MatchRatingApplicationGetPayload<{
  select: typeof applicationSelect;
}>;
type ChangeRow = Prisma.PlayerRatingChangeGetPayload<{ select: typeof changeSelect }>;

function decodeLeaderboardCursor(cursor: string | undefined): { id: string; rank: number } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (
      typeof value !== 'object' ||
      value === null ||
      !('id' in value) ||
      !('rank' in value) ||
      typeof value.id !== 'string' ||
      !Number.isSafeInteger(value.rank) ||
      Number(value.rank) < 1
    )
      return null;
    return { id: value.id, rank: Number(value.rank) };
  } catch {
    return null;
  }
}

const encodeLeaderboardCursor = (id: string, rank: number): string =>
  Buffer.from(JSON.stringify({ id, rank }), 'utf8').toString('base64url');

const mapRating = (row: RatingRow): PlayerRatingRecord => ({
  ...row,
  policyKey: 'ELO',
  policyVersion: 1,
});
const mapApplication = (row: ApplicationRow): MatchRatingApplicationRecord => ({
  ...row,
  policyKey: 'ELO',
  policyVersion: 1,
});
const mapChange = (row: ChangeRow): RatingChangeRecord => ({
  ...row,
  policyKey: 'ELO',
  policyVersion: 1,
  calculationSnapshot:
    row.calculationSnapshot as unknown as RatingChangeRecord['calculationSnapshot'],
});

function persistence(error: unknown): never {
  if (error instanceof RatingError) throw error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code?: unknown }).code) === 'P2002'
  )
    throw new RatingError('RATING_APPLICATION_ALREADY_EXISTS');
  throw new RatingError('RATING_PERSISTENCE_FAILURE');
}

export class PrismaRatingRepository implements RatingRepository {
  public constructor(private readonly client: Client) {}

  public async findMatchRatingContext(matchId: string): Promise<MatchRatingContext | null> {
    const row = await this.client.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        gameId: true,
        gameModeId: true,
        crossplayGroupId: true,
        completedAt: true,
        settlementEligibleAt: true,
        participants: {
          select: { id: true, userId: true },
          orderBy: { userId: 'asc' },
        },
        result: {
          select: {
            id: true,
            status: true,
            version: true,
            winnerParticipantId: true,
            loserParticipantId: true,
            isDraw: true,
            confirmedAt: true,
          },
        },
        disputes: {
          where: { status: { in: ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW'] } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!row) return null;
    const resolved = await this.client.matchDispute.findFirst({
      where: { matchId, status: { in: ['RESOLVED', 'REJECTED'] } },
      select: { resolvedAt: true },
      orderBy: { resolvedAt: 'desc' },
    });
    return {
      matchId: row.id,
      matchStatus: row.status,
      gameId: row.gameId,
      gameModeId: row.gameModeId,
      crossplayGroupId: row.crossplayGroupId,
      policyKey: 'ELO',
      policyVersion: 1,
      completedAt: row.completedAt,
      settlementEligibleAt: row.settlementEligibleAt,
      result: row.result,
      participants: row.participants,
      activeDispute: row.disputes.length > 0,
      resolvedDisputeAt: resolved?.resolvedAt ?? null,
    };
  }

  public async findApplicationByMatchId(matchId: string) {
    const row = await this.client.matchRatingApplication.findUnique({
      where: { matchId },
      select: applicationSelect,
    });
    return row ? mapApplication(row) : null;
  }

  public async findApplicationByIdempotencyKey(idempotencyKey: string) {
    const row = await this.client.matchRatingApplication.findUnique({
      where: { idempotencyKey },
      select: applicationSelect,
    });
    return row ? mapApplication(row) : null;
  }

  public async ensurePlayerRating(input: EnsurePlayerRatingInput): Promise<PlayerRatingRecord> {
    try {
      return mapRating(
        await this.client.playerRating.upsert({
          where: {
            userId_gameId_gameModeId_crossplayGroupId_policyKey_policyVersion: {
              userId: input.userId,
              gameId: input.gameId,
              gameModeId: input.gameModeId,
              crossplayGroupId: input.crossplayGroupId,
              policyKey: input.policyKey,
              policyVersion: input.policyVersion,
            },
          },
          create: {
            id: input.id,
            userId: input.userId,
            gameId: input.gameId,
            gameModeId: input.gameModeId,
            crossplayGroupId: input.crossplayGroupId,
            policyKey: input.policyKey,
            policyVersion: input.policyVersion,
            rating: input.initialRating,
            highestRating: input.initialRating,
            lowestRating: input.initialRating,
            createdAt: input.now,
            updatedAt: input.now,
          },
          update: {},
          select: ratingSelect,
        }),
      );
    } catch (error) {
      return persistence(error);
    }
  }

  public async applyRatingChanges(
    input: PersistRatingApplicationInput,
  ): Promise<MatchRatingApplicationRecord> {
    try {
      const result = input.context.result;
      if (!result) throw new RatingError('RATING_APPLICATION_RESULT_INVALID');
      const ids = input.changes.map((change) => change.rating.id).sort();
      await this.client.$queryRaw(
        Prisma.sql`SELECT id FROM player_ratings WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
      );
      const application = await this.client.matchRatingApplication.create({
        data: {
          id: input.applicationId,
          matchId: input.context.matchId,
          matchResultId: result.id,
          status: 'APPLIED',
          policyKey: input.context.policyKey,
          policyVersion: input.context.policyVersion,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
          appliedAt: input.now,
        },
        select: applicationSelect,
      });
      for (const change of input.changes) {
        const win = change.outcome === 'WIN' ? 1 : 0;
        const loss = change.outcome === 'LOSS' ? 1 : 0;
        const draw = change.outcome === 'DRAW' ? 1 : 0;
        const updated = await this.client.playerRating.updateMany({
          where: { id: change.rating.id, version: change.rating.version },
          data: {
            rating: change.ratingAfter,
            matchesPlayed: { increment: 1 },
            wins: { increment: win },
            losses: { increment: loss },
            draws: { increment: draw },
            provisionalMatchesPlayed: {
              increment:
                change.rating.provisionalMatchesPlayed < input.provisionalMatchCount ? 1 : 0,
            },
            highestRating: Math.max(change.rating.highestRating, change.ratingAfter),
            lowestRating: Math.min(change.rating.lowestRating, change.ratingAfter),
            lastMatchId: input.context.matchId,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new RatingError('RATING_INVARIANT_VIOLATION');
        await this.client.playerRatingChange.create({
          data: {
            id: change.id,
            playerRatingId: change.rating.id,
            ratingApplicationId: application.id,
            matchId: input.context.matchId,
            matchResultId: result.id,
            userId: change.rating.userId,
            opponentUserId: change.opponentUserId,
            outcome: change.outcome,
            ratingBefore: change.ratingBefore,
            ratingAfter: change.ratingAfter,
            ratingDelta: change.ratingDelta,
            opponentRatingBefore: change.opponentRatingBefore,
            policyKey: input.context.policyKey,
            policyVersion: input.context.policyVersion,
            calculationSnapshot: change.snapshot as unknown as Prisma.InputJsonValue,
            appliedAt: input.now,
          },
        });
      }
      return mapApplication(application);
    } catch (error) {
      return persistence(error);
    }
  }

  public async getMyRatings(userId: string): Promise<readonly MyRatingView[]> {
    const rows = await this.client.playerRating.findMany({
      where: { userId },
      select: {
        rating: true,
        matchesPlayed: true,
        wins: true,
        losses: true,
        draws: true,
        provisionalMatchesPlayed: true,
        highestRating: true,
        game: { select: { key: true, name: true } },
        gameMode: { select: { key: true, name: true } },
        crossplayGroup: { select: { key: true, name: true } },
      },
      orderBy: [{ game: { key: 'asc' } }, { gameMode: { key: 'asc' } }],
    });
    return rows.map((row) => ({
      game: row.game,
      mode: row.gameMode,
      crossplayGroup: row.crossplayGroup,
      rating: row.rating,
      rank: null,
      matchesPlayed: row.matchesPlayed,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      provisional: row.provisionalMatchesPlayed < 10,
      highestRating: row.highestRating,
    }));
  }

  public async getMyRating(userId: string, gameKey: string, modeKey: string) {
    return (
      (await this.getMyRatings(userId)).find(
        (rating) => rating.game.key === gameKey && rating.mode.key === modeKey,
      ) ?? null
    );
  }

  public async getMyRatingHistory(
    userId: string,
    gameKey: string,
    modeKey: string,
    cursor: string | undefined,
    limit: number,
  ) {
    const rows = await this.client.playerRatingChange.findMany({
      where: {
        userId,
        playerRating: { game: { key: gameKey }, gameMode: { key: modeKey } },
        reversedAt: null,
      },
      select: {
        id: true,
        matchId: true,
        outcome: true,
        ratingBefore: true,
        ratingAfter: true,
        ratingDelta: true,
        appliedAt: true,
      },
      orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items: RatingHistoryItemView[] = rows.slice(0, limit).map((row) => ({
      matchId: row.matchId,
      outcome: row.outcome as RatingHistoryItemView['outcome'],
      ratingBefore: row.ratingBefore,
      ratingAfter: row.ratingAfter,
      ratingDelta: row.ratingDelta,
      appliedAt: row.appliedAt,
    }));
    return { items, nextCursor: hasMore ? (rows[limit - 1]?.id ?? null) : null };
  }

  public async resolveScope(
    gameKey: string,
    modeKey: string,
    crossplayGroupKey?: string,
  ): Promise<RatingScope | null> {
    const mode = await this.client.gameMode.findFirst({
      where: { key: modeKey, game: { key: gameKey } },
      select: { id: true, gameId: true },
    });
    if (!mode) return null;
    const group = await this.client.crossplayGroup.findFirst({
      where: {
        gameId: mode.gameId,
        ...(crossplayGroupKey ? { key: crossplayGroupKey } : { status: 'ACTIVE' }),
      },
      select: { id: true },
      orderBy: { sortOrder: 'asc' },
    });
    return group
      ? {
          gameId: mode.gameId,
          gameModeId: mode.id,
          crossplayGroupId: group.id,
          policyKey: 'ELO',
          policyVersion: 1,
        }
      : null;
  }

  public async listLeaderboard(query: LeaderboardQuery): Promise<LeaderboardPage> {
    const cursor = decodeLeaderboardCursor(query.cursor);
    if (query.cursor && !cursor) throw new RatingError('LEADERBOARD_UNAVAILABLE');
    const rows = await this.client.playerRating.findMany({
      where: {
        gameId: query.gameId,
        gameModeId: query.gameModeId,
        crossplayGroupId: query.crossplayGroupId,
        policyKey: query.policyKey,
        policyVersion: query.policyVersion,
        matchesPlayed: { gte: query.minimumMatchesPlayed },
        user: {
          status: 'ACTIVE',
          gameAccounts: {
            some: { gameId: query.gameId, status: 'VERIFIED', verifiedAt: { not: null } },
          },
        },
      },
      select: {
        id: true,
        rating: true,
        matchesPlayed: true,
        wins: true,
        losses: true,
        draws: true,
        user: {
          select: {
            profile: { select: { displayName: true } },
            gameAccounts: {
              where: { gameId: query.gameId, status: 'VERIFIED' },
              select: { displayHandle: true },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
              take: 1,
            },
          },
        },
      },
      orderBy: [
        { rating: 'desc' },
        { matchesPlayed: 'desc' },
        { wins: 'desc' },
        { updatedAt: 'asc' },
        { id: 'asc' },
      ],
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    return {
      items: rows.slice(0, query.limit).map((row, index) => ({
        rank: (cursor?.rank ?? 0) + index + 1,
        player: {
          displayName: row.user.profile?.displayName ?? 'Player',
          gameHandle: row.user.gameAccounts[0]?.displayHandle ?? 'Player',
        },
        rating: row.rating,
        matchesPlayed: row.matchesPlayed,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
      })),
      nextCursor: hasMore
        ? (() => {
            const last = rows[query.limit - 1];
            return last
              ? encodeLeaderboardCursor(last.id, (cursor?.rank ?? 0) + query.limit)
              : null;
          })()
        : null,
    };
  }

  public async getMyRank(
    userId: string,
    scope: RatingScope,
    minimumMatches: number,
  ): Promise<number | null> {
    const mine = await this.client.playerRating.findFirst({
      where: { userId, ...scope, matchesPlayed: { gte: minimumMatches } },
      select: { id: true, rating: true, matchesPlayed: true, wins: true, updatedAt: true },
    });
    if (!mine) return null;
    const ahead = await this.client.playerRating.count({
      where: {
        ...scope,
        matchesPlayed: { gte: minimumMatches },
        user: { status: 'ACTIVE' },
        OR: [
          { rating: { gt: mine.rating } },
          { rating: mine.rating, matchesPlayed: { gt: mine.matchesPlayed } },
          {
            rating: mine.rating,
            matchesPlayed: mine.matchesPlayed,
            wins: { gt: mine.wins },
          },
          {
            rating: mine.rating,
            matchesPlayed: mine.matchesPlayed,
            wins: mine.wins,
            updatedAt: { lt: mine.updatedAt },
          },
          {
            rating: mine.rating,
            matchesPlayed: mine.matchesPlayed,
            wins: mine.wins,
            updatedAt: mine.updatedAt,
            id: { lt: mine.id },
          },
        ],
      },
    });
    return ahead + 1;
  }

  public async listEligibleMatches(now: Date, limit: number) {
    const rows = await this.client.match.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { lte: now },
        ratingApplication: null,
        result: { is: { status: { in: ['CONFIRMED', 'ADMIN_RESOLVED'] } } },
        disputes: { none: { status: { in: ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW'] } } },
      },
      select: { id: true },
      orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map((row) => row.id);
  }

  public async listFailedApplications(limit: number) {
    return (
      await this.client.matchRatingApplication.findMany({
        where: { status: 'FAILED' },
        select: applicationSelect,
        orderBy: [{ failedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      })
    ).map(mapApplication);
  }

  public async reconcilePlayerRating(playerRatingId: string) {
    const rating = await this.client.playerRating.findUnique({
      where: { id: playerRatingId },
      select: ratingSelect,
    });
    if (!rating) return null;
    const changes = await this.client.playerRatingChange.findMany({
      where: { playerRatingId },
      select: changeSelect,
      orderBy: [{ appliedAt: 'asc' }, { id: 'asc' }],
    });
    return { rating: mapRating(rating), changes: changes.map(mapChange) };
  }

  public async listAdmin(limit: number) {
    return (
      await this.client.playerRating.findMany({
        select: ratingSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      })
    ).map(mapRating);
  }

  public async listForAdminUser(userId: string) {
    return (
      await this.client.playerRating.findMany({
        where: { userId },
        select: ratingSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      })
    ).map(mapRating);
  }
}
