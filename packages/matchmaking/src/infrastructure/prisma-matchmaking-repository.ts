import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { MatchmakingError } from '../domain/matchmaking-errors';
import type {
  MatchmakingCreationContext,
  MatchmakingCriteria,
  MatchmakingProposal,
  MatchmakingRequest,
  MatchmakingRequestStatus,
} from '../domain/matchmaking-types';
import type {
  CreateMatchmakingRecord,
  MatchmakingRepository,
} from '../ports/matchmaking-repository';
import type { MatchmakingTransactionManager } from '../ports/matchmaking-transaction-manager';

type Client = ArenaPrismaClient | Prisma.TransactionClient;
const requestSelect = {
  id: true,
  userId: true,
  userGameAccountId: true,
  gameId: true,
  gameModeId: true,
  gameRulesetId: true,
  gamePlatformId: true,
  crossplayGroupId: true,
  status: true,
  searchScope: true,
  criteria: true,
  priority: true,
  createdAt: true,
  expiresAt: true,
  version: true,
  userGameAccount: { select: { status: true } },
  game: { select: { status: true, isVisible: true } },
  gameMode: { select: { status: true } },
  gameRuleset: { select: { status: true } },
  gamePlatform: { select: { status: true } },
  crossplayGroup: { select: { status: true } },
} satisfies Prisma.MatchmakingRequestSelect;
type RequestRow = Prisma.MatchmakingRequestGetPayload<{ select: typeof requestSelect }>;
const proposalSelect = {
  id: true,
  status: true,
  requestAId: true,
  requestBId: true,
  gameId: true,
  gameModeId: true,
  gameRulesetId: true,
  crossplayGroupId: true,
  expiresAt: true,
  acceptedAAt: true,
  acceptedBAt: true,
  version: true,
  requestA: { select: { userId: true } },
  requestB: { select: { userId: true } },
} satisfies Prisma.MatchmakingProposalSelect;
type ProposalRow = Prisma.MatchmakingProposalGetPayload<{ select: typeof proposalSelect }>;

function request(row: RequestRow): MatchmakingRequest {
  return {
    ...row,
    criteria: row.criteria as unknown as MatchmakingCriteria,
    accountVerified: row.userGameAccount.status === 'VERIFIED',
    catalogValid:
      row.game.status === 'ACTIVE' &&
      row.game.isVisible &&
      row.gameMode.status === 'ACTIVE' &&
      row.gameRuleset.status === 'ACTIVE' &&
      row.gamePlatform.status === 'ACTIVE' &&
      row.crossplayGroup.status === 'ACTIVE',
  };
}
function proposal(row: ProposalRow): MatchmakingProposal {
  return { ...row, userAId: row.requestA.userId, userBId: row.requestB.userId };
}
function mapPersistence(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ['P2002', 'P2025'].includes(String((error as { code?: unknown }).code))
  )
    throw new MatchmakingError('MATCHMAKING_CONFLICT');
  throw new MatchmakingError('MATCHMAKING_PERSISTENCE_FAILURE');
}
async function inTransaction<T>(
  client: Client,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ('$transaction' in client) return client.$transaction(operation);
  return operation(client);
}
function requestStatusData(status: MatchmakingRequestStatus, now: Date) {
  return {
    status,
    version: { increment: 1 },
    ...(status === 'SEARCHING' ? { searchStartedAt: now } : {}),
    ...(status === 'CANCELLED' ? { cancelledAt: now } : {}),
    ...(status === 'MATCHED' ? { matchedAt: now } : {}),
  };
}

export class PrismaMatchmakingRepository implements MatchmakingRepository {
  public constructor(private readonly client: Client) {}
  public async listUserRequests(userId: string, limit: number) {
    return (
      await this.client.matchmakingRequest.findMany({
        where: { userId },
        select: requestSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      })
    ).map(request);
  }
  public async findRequestForUser(userId: string, requestId: string) {
    const row = await this.client.matchmakingRequest.findFirst({
      where: { id: requestId, userId },
      select: requestSelect,
    });
    return row && request(row);
  }
  public async findRequestById(requestId: string) {
    const row = await this.client.matchmakingRequest.findUnique({
      where: { id: requestId },
      select: requestSelect,
    });
    return row && request(row);
  }
  public async resolveCreationContext(
    userId: string,
    accountId: string,
    gameModeId: string,
    gameRulesetId: string,
  ): Promise<MatchmakingCreationContext | null> {
    const account = await this.client.userGameAccount.findFirst({
      where: { id: accountId, userId },
      select: {
        id: true,
        userId: true,
        gameId: true,
        gamePlatformId: true,
        status: true,
        game: { select: { status: true, isVisible: true } },
        gamePlatform: {
          select: {
            status: true,
            crossplayGroupMemberships: {
              where: { crossplayGroup: { status: 'ACTIVE' } },
              select: { crossplayGroupId: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!account) return null;
    const [mode, ruleset] = await Promise.all([
      this.client.gameMode.findFirst({
        where: { id: gameModeId, gameId: account.gameId, status: 'ACTIVE' },
        select: { id: true },
      }),
      this.client.gameRuleset.findFirst({
        where: {
          id: gameRulesetId,
          gameId: account.gameId,
          gameModeId,
          status: 'ACTIVE',
        },
        select: { id: true },
      }),
    ]);
    const group = account.gamePlatform.crossplayGroupMemberships[0];
    return {
      userId,
      userGameAccountId: account.id,
      gameId: account.gameId,
      gameModeId,
      gameRulesetId,
      gamePlatformId: account.gamePlatformId,
      crossplayGroupId: group?.crossplayGroupId ?? '',
      accountVerified: account.status === 'VERIFIED',
      catalogValid:
        account.game.status === 'ACTIVE' &&
        account.game.isVisible &&
        account.gamePlatform.status === 'ACTIVE' &&
        mode !== null &&
        ruleset !== null &&
        group !== undefined,
    };
  }
  public async findActiveRequestByUser(userId: string) {
    const row = await this.client.matchmakingRequest.findFirst({
      where: { userId, status: { in: ['PENDING', 'SEARCHING', 'PROPOSED'] } },
      select: requestSelect,
    });
    return row && request(row);
  }
  public async createRequest(input: CreateMatchmakingRecord) {
    try {
      return request(
        await this.client.matchmakingRequest.create({
          data: {
            userId: input.userId,
            userGameAccountId: input.userGameAccountId,
            gameId: input.gameId,
            gameModeId: input.gameModeId,
            gameRulesetId: input.gameRulesetId,
            gamePlatformId: input.gamePlatformId,
            crossplayGroupId: input.crossplayGroupId,
            status: 'PENDING',
            searchScope: input.searchScope,
            criteria: input.criteria as unknown as Prisma.InputJsonValue,
            priority: 0,
            expiresAt: input.expiresAt,
          },
          select: requestSelect,
        }),
      );
    } catch (error) {
      return mapPersistence(error);
    }
  }
  public async transitionRequest(
    requestId: string,
    expectedVersion: number,
    status: MatchmakingRequestStatus,
    now: Date,
  ) {
    try {
      const updated = await this.client.matchmakingRequest.updateMany({
        where: { id: requestId, version: expectedVersion },
        data: requestStatusData(status, now),
      });
      if (updated.count !== 1) throw new MatchmakingError('MATCHMAKING_CONFLICT');
      const row = await this.findRequestById(requestId);
      if (!row) throw new MatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND');
      return row;
    } catch (error) {
      if (error instanceof MatchmakingError) throw error;
      return mapPersistence(error);
    }
  }
  public async listCandidateRequests(source: MatchmakingRequest, limit: number) {
    return (
      await this.client.matchmakingRequest.findMany({
        where: {
          id: { not: source.id },
          userId: { not: source.userId },
          status: 'SEARCHING',
          gameId: source.gameId,
          gameModeId: source.gameModeId,
          gameRulesetId: source.gameRulesetId,
          crossplayGroupId: source.crossplayGroupId,
          expiresAt: { gt: new Date() },
        },
        select: requestSelect,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
      })
    ).map(request);
  }
  public async hasActiveProposal(requestId: string) {
    return (
      (await this.client.matchmakingProposal.count({
        where: {
          status: 'PENDING',
          OR: [{ requestAId: requestId }, { requestBId: requestId }],
        },
      })) > 0
    );
  }
  public async createProposalForPair(
    left: MatchmakingRequest,
    right: MatchmakingRequest,
    expiresAt: Date,
  ) {
    const [requestA, requestB] = [left, right].sort((a, b) => a.id.localeCompare(b.id));
    if (!requestA || !requestB) throw new MatchmakingError('MATCHMAKING_COMPATIBILITY_FAILURE');
    try {
      const leftUpdate = await this.client.matchmakingRequest.updateMany({
        where: { id: left.id, version: left.version, status: 'SEARCHING' },
        data: { status: 'PROPOSED', version: { increment: 1 } },
      });
      const rightUpdate = await this.client.matchmakingRequest.updateMany({
        where: { id: right.id, version: right.version, status: 'SEARCHING' },
        data: { status: 'PROPOSED', version: { increment: 1 } },
      });
      if (leftUpdate.count !== 1 || rightUpdate.count !== 1)
        throw new MatchmakingError('MATCHMAKING_CONFLICT');
      return proposal(
        await this.client.matchmakingProposal.create({
          data: {
            requestAId: requestA.id,
            requestBId: requestB.id,
            gameId: left.gameId,
            gameModeId: left.gameModeId,
            gameRulesetId: left.gameRulesetId,
            crossplayGroupId: left.crossplayGroupId,
            expiresAt,
          },
          select: proposalSelect,
        }),
      );
    } catch (error) {
      if (error instanceof MatchmakingError) throw error;
      return mapPersistence(error);
    }
  }
  public async findCurrentProposalForUser(userId: string) {
    const row = await this.client.matchmakingProposal.findFirst({
      where: {
        status: 'PENDING',
        OR: [{ requestA: { userId } }, { requestB: { userId } }],
      },
      select: proposalSelect,
      orderBy: { createdAt: 'desc' },
    });
    return row && proposal(row);
  }
  public async findProposalForUser(userId: string, proposalId: string) {
    const row = await this.client.matchmakingProposal.findFirst({
      where: {
        id: proposalId,
        OR: [{ requestA: { userId } }, { requestB: { userId } }],
      },
      select: proposalSelect,
    });
    return row && proposal(row);
  }
  public async acceptProposal(
    userId: string,
    proposalId: string,
    expectedVersion: number,
    now: Date,
  ) {
    try {
      await inTransaction(this.client, async (tx) => {
        const current = await tx.matchmakingProposal.findFirst({
          where: {
            id: proposalId,
            version: expectedVersion,
            status: 'PENDING',
            expiresAt: { gt: now },
            OR: [{ requestA: { userId } }, { requestB: { userId } }],
          },
          select: proposalSelect,
        });
        if (!current) throw new MatchmakingError('MATCHMAKING_CONFLICT');
        const isA = current.requestA.userId === userId;
        const acceptedAAt = isA ? now : current.acceptedAAt;
        const acceptedBAt = isA ? current.acceptedBAt : now;
        const both = acceptedAAt !== null && acceptedBAt !== null;
        await tx.matchmakingProposal.update({
          where: { id: proposalId },
          data: {
            acceptedAAt,
            acceptedBAt,
            version: { increment: 1 },
            ...(both ? { status: 'ACCEPTED', completedAt: now } : {}),
          },
        });
        if (both)
          await tx.matchmakingRequest.updateMany({
            where: { id: { in: [current.requestAId, current.requestBId] }, status: 'PROPOSED' },
            data: { status: 'MATCHED', matchedAt: now, version: { increment: 1 } },
          });
      });
      const updated = await this.findProposalForUser(userId, proposalId);
      if (!updated) throw new MatchmakingError('MATCHMAKING_PROPOSAL_NOT_FOUND');
      return updated;
    } catch (error) {
      if (error instanceof MatchmakingError) throw error;
      return mapPersistence(error);
    }
  }
  public async rejectProposal(
    userId: string,
    proposalId: string,
    expectedVersion: number,
    now: Date,
  ) {
    await this.finishProposalWithRequestRestoration(
      userId,
      proposalId,
      expectedVersion,
      now,
      'REJECTED',
    );
  }
  public async cancelRequest(userId: string, requestId: string, now: Date) {
    try {
      await inTransaction(this.client, async (tx) => {
        const row = await tx.matchmakingRequest.findFirst({
          where: { id: requestId, userId },
          select: { id: true, status: true, expiresAt: true },
        });
        if (!row) throw new MatchmakingError('MATCHMAKING_REQUEST_NOT_FOUND');
        if (['CANCELLED', 'EXPIRED', 'MATCHED', 'FAILED'].includes(row.status)) return;
        const activeProposal = await tx.matchmakingProposal.findFirst({
          where: {
            status: 'PENDING',
            OR: [{ requestAId: requestId }, { requestBId: requestId }],
          },
          select: { id: true, requestAId: true, requestBId: true },
        });
        if (activeProposal) {
          await tx.matchmakingProposal.update({
            where: { id: activeProposal.id },
            data: { status: 'CANCELLED', version: { increment: 1 } },
          });
          const other =
            activeProposal.requestAId === requestId
              ? activeProposal.requestBId
              : activeProposal.requestAId;
          await tx.matchmakingRequest.updateMany({
            where: { id: other, status: 'PROPOSED' },
            data: { status: 'SEARCHING', searchStartedAt: now, version: { increment: 1 } },
          });
        }
        await tx.matchmakingRequest.update({
          where: { id: requestId },
          data: { status: 'CANCELLED', cancelledAt: now, version: { increment: 1 } },
        });
      });
    } catch (error) {
      if (error instanceof MatchmakingError) throw error;
      mapPersistence(error);
    }
  }
  public async expireRequests(now: Date, limit: number) {
    const rows = await this.client.matchmakingRequest.findMany({
      where: { status: { in: ['PENDING', 'SEARCHING'] }, expiresAt: { lte: now } },
      select: { id: true },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
    const result = await this.client.matchmakingRequest.updateMany({
      where: { id: { in: rows.map(({ id }) => id) }, status: { in: ['PENDING', 'SEARCHING'] } },
      data: { status: 'EXPIRED', version: { increment: 1 } },
    });
    return result.count;
  }
  public async expireProposals(now: Date, limit: number) {
    const rows = await this.client.matchmakingProposal.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      select: { id: true, version: true, requestA: { select: { userId: true } } },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
    for (const row of rows)
      await this.finishProposalWithRequestRestoration(
        row.requestA.userId,
        row.id,
        row.version,
        now,
        'EXPIRED',
      );
    return rows.length;
  }
  public async listAdminRequests(limit: number) {
    return (
      await this.client.matchmakingRequest.findMany({
        select: requestSelect,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map(request);
  }
  public async listAdminProposals(limit: number) {
    return (
      await this.client.matchmakingProposal.findMany({
        select: proposalSelect,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    ).map(proposal);
  }
  private async finishProposalWithRequestRestoration(
    userId: string,
    proposalId: string,
    expectedVersion: number,
    now: Date,
    status: 'REJECTED' | 'EXPIRED',
  ) {
    try {
      await inTransaction(this.client, async (tx) => {
        const current = await tx.matchmakingProposal.findFirst({
          where: {
            id: proposalId,
            version: expectedVersion,
            status: 'PENDING',
            OR: [{ requestA: { userId } }, { requestB: { userId } }],
          },
          select: { requestAId: true, requestBId: true },
        });
        if (!current) throw new MatchmakingError('MATCHMAKING_CONFLICT');
        await tx.matchmakingProposal.update({
          where: { id: proposalId },
          data: {
            status,
            version: { increment: 1 },
            ...(status === 'REJECTED' ? { rejectedAt: now, rejectedByUserId: userId } : {}),
          },
        });
        await tx.matchmakingRequest.updateMany({
          where: {
            id: { in: [current.requestAId, current.requestBId] },
            status: 'PROPOSED',
            expiresAt: { gt: now },
          },
          data: { status: 'SEARCHING', searchStartedAt: now, version: { increment: 1 } },
        });
        await tx.matchmakingRequest.updateMany({
          where: {
            id: { in: [current.requestAId, current.requestBId] },
            status: 'PROPOSED',
            expiresAt: { lte: now },
          },
          data: { status: 'EXPIRED', version: { increment: 1 } },
        });
      });
    } catch (error) {
      if (error instanceof MatchmakingError) throw error;
      mapPersistence(error);
    }
  }
}

export class PrismaMatchmakingTransactionManager implements MatchmakingTransactionManager {
  public constructor(private readonly client: ArenaPrismaClient) {}
  public transaction<T>(operation: (repository: MatchmakingRepository) => Promise<T>): Promise<T> {
    return this.client.$transaction((tx) => operation(new PrismaMatchmakingRepository(tx)));
  }
}
