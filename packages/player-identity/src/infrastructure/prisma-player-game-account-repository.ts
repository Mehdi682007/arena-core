import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { PlayerIdentityError } from '../domain/player-identity-errors';
import type {
  AdminReviewInput,
  AdminGameAccountPage,
  AdminGameAccountQuery,
  AdminGameAccountRecord,
  ClaimableGamePlatform,
  GameAccountReview,
  GameAccountStatus,
  UserGameAccountRecord,
} from '../domain/player-identity-types';
import type {
  CreateClaimRecord,
  PlayerGameAccountRepository,
  UpdateClaimRecord,
} from '../ports/player-game-account-repository';

const activeStatuses = ['DRAFT', 'PENDING', 'VERIFIED', 'CHANGES_REQUESTED', 'SUSPENDED'] as const;
const zUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const accountSelect = {
  id: true,
  userId: true,
  gameId: true,
  gamePlatformId: true,
  handle: true,
  normalizedHandle: true,
  displayHandle: true,
  status: true,
  verificationMethod: true,
  isPrimary: true,
  submittedAt: true,
  reviewedAt: true,
  reviewedByUserId: true,
  verifiedAt: true,
  rejectionReasonCode: true,
  reviewMessage: true,
  suspensionReasonCode: true,
  version: true,
  deletedAt: true,
  createdAt: true,
  game: { select: { id: true, key: true, slug: true, name: true } },
  gamePlatform: {
    select: {
      platform: { select: { id: true, key: true, slug: true, name: true } },
    },
  },
} satisfies Prisma.UserGameAccountSelect;
const adminAccountSelect = {
  ...accountSelect,
  user: { select: { profile: { select: { displayName: true } } } },
} satisfies Prisma.UserGameAccountSelect;
type AccountRow = Prisma.UserGameAccountGetPayload<{ select: typeof accountSelect }>;
type AdminAccountRow = Prisma.UserGameAccountGetPayload<{ select: typeof adminAccountSelect }>;
function record(row: AccountRow): UserGameAccountRecord {
  return { ...row, game: row.game, platform: row.gamePlatform.platform };
}
function adminRecord(row: AdminAccountRow): AdminGameAccountRecord {
  return {
    ...record(row),
    ownerDisplayName: row.user.profile?.displayName ?? null,
  };
}
function persistenceError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
    throw new PlayerIdentityError('GAME_ACCOUNT_HANDLE_CONFLICT');
  throw new PlayerIdentityError('GAME_ACCOUNT_PERSISTENCE_FAILURE');
}
function statusDates(status: GameAccountStatus, now: Date) {
  return {
    ...(status === 'VERIFIED'
      ? { verifiedAt: now, lastVerifiedAt: now, rejectedAt: null, suspendedAt: null }
      : {}),
    ...(status === 'REJECTED' ? { rejectedAt: now } : {}),
    ...(status === 'SUSPENDED' ? { suspendedAt: now } : {}),
    ...(status === 'DISCONNECTED' ? { disconnectedAt: now } : {}),
  };
}
export class PrismaPlayerGameAccountRepository implements PlayerGameAccountRepository {
  public constructor(private readonly client: ArenaPrismaClient) {}
  public async userCanClaim(userId: string): Promise<boolean> {
    return (
      (await this.client.user.count({
        where: { id: userId, status: 'ACTIVE', deletedAt: null },
      })) === 1
    );
  }
  public async listUserGameAccounts(userId: string): Promise<readonly UserGameAccountRecord[]> {
    const rows = await this.client.userGameAccount.findMany({
      where: { userId },
      select: accountSelect,
      orderBy: [
        { game: { sortOrder: 'asc' } },
        { gamePlatform: { sortOrder: 'asc' } },
        { createdAt: 'asc' },
      ],
    });
    return rows.map(record);
  }
  public async findUserGameAccount(
    userId: string,
    accountId: string,
  ): Promise<UserGameAccountRecord | null> {
    const row = await this.client.userGameAccount.findFirst({
      where: { id: accountId, userId },
      select: accountSelect,
    });
    return row && record(row);
  }
  public async findAccountForAdmin(accountId: string): Promise<AdminGameAccountRecord | null> {
    const row = await this.client.userGameAccount.findUnique({
      where: { id: accountId },
      select: adminAccountSelect,
    });
    return row && adminRecord(row);
  }
  public async listClaimableGamePlatforms(): Promise<readonly ClaimableGamePlatform[]> {
    const rows = await this.client.gamePlatform.findMany({
      where: {
        status: 'ACTIVE',
        game: {
          status: 'ACTIVE',
        },
      },
      select: {
        id: true,
        status: true,
        game: {
          select: {
            id: true,
            key: true,
            slug: true,
            name: true,
            status: true,
          },
        },
        platform: {
          select: {
            id: true,
            key: true,
            slug: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          game: {
            sortOrder: 'asc',
          },
        },
        {
          sortOrder: 'asc',
        },
      ],
    });

    return rows.map((row) => ({
      game: row.game,
      platform: row.platform,
      gamePlatformId: row.id,
      gameActive: row.game.status === 'ACTIVE',
      gamePlatformActive: row.status === 'ACTIVE',
    }));
  }

  public async findGamePlatformForClaim(
    gameId: string,
    gamePlatformId: string,
  ): Promise<ClaimableGamePlatform | null> {
    const row = await this.client.gamePlatform.findFirst({
      where: { id: gamePlatformId, gameId },
      select: {
        id: true,
        status: true,
        game: { select: { id: true, key: true, slug: true, name: true, status: true } },
        platform: { select: { id: true, key: true, slug: true, name: true } },
      },
    });
    return row
      ? {
          game: row.game,
          platform: row.platform,
          gamePlatformId: row.id,
          gameActive: row.game.status === 'ACTIVE',
          gamePlatformActive: row.status === 'ACTIVE',
        }
      : null;
  }
  public async hasActiveUserPlatformClaim(
    userId: string,
    gamePlatformId: string,
  ): Promise<boolean> {
    return (
      (await this.client.userGameAccount.count({
        where: { userId, gamePlatformId, deletedAt: null, status: { in: [...activeStatuses] } },
      })) > 0
    );
  }
  public async hasActiveHandleClaim(
    gamePlatformId: string,
    normalizedHandle: string,
  ): Promise<boolean> {
    return (
      (await this.client.userGameAccount.count({
        where: {
          gamePlatformId,
          normalizedHandle,
          deletedAt: null,
          status: { in: [...activeStatuses] },
        },
      })) > 0
    );
  }
  public async createGameAccountClaim(input: CreateClaimRecord): Promise<UserGameAccountRecord> {
    try {
      return await this.client.$transaction(async (tx) => {
        const created = await tx.userGameAccount.create({
          data: { ...input, status: 'DRAFT', verificationMethod: 'UNVERIFIED' },
          select: accountSelect,
        });
        await tx.gameAccountReview.create({
          data: { gameAccountId: created.id, actorUserId: input.userId, action: 'CREATE' },
        });
        return record(created);
      });
    } catch (error) {
      return persistenceError(error);
    }
  }
  public async updateGameAccountClaim(input: UpdateClaimRecord): Promise<UserGameAccountRecord> {
    try {
      return await this.client.$transaction(async (tx) => {
        const updated = await tx.userGameAccount.updateMany({
          where: {
            id: input.accountId,
            userId: input.userId,
            version: input.expectedVersion,
            deletedAt: null,
            status: { in: ['DRAFT', 'CHANGES_REQUESTED', 'VERIFIED'] },
          },
          data: {
            gameId: input.gameId,
            gamePlatformId: input.gamePlatformId,
            handle: input.handle,
            normalizedHandle: input.normalizedHandle,
            displayHandle: input.displayHandle,
            status: input.nextStatus,
            ...(input.nextStatus === 'PENDING'
              ? {
                  submittedAt: new Date(),
                  reviewedAt: null,
                  reviewedByUserId: null,
                  verifiedAt: null,
                  verificationMethod: 'UNVERIFIED' as const,
                  verificationMetadata: Prisma.JsonNull,
                  rejectionReasonCode: null,
                  reviewMessage: null,
                }
              : {}),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new PlayerIdentityError('GAME_ACCOUNT_VERSION_CONFLICT');
        await tx.gameAccountReview.create({
          data: { gameAccountId: input.accountId, actorUserId: input.userId, action: 'UPDATE' },
        });
        const account = await tx.userGameAccount.findFirst({
          where: { id: input.accountId, userId: input.userId },
          select: accountSelect,
        });
        if (!account) throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
        return record(account);
      });
    } catch (error) {
      if (error instanceof PlayerIdentityError) throw error;
      return persistenceError(error);
    }
  }
  public async submitGameAccount(
    userId: string,
    accountId: string,
    expectedVersion: number,
  ): Promise<UserGameAccountRecord> {
    return this.client.$transaction(async (tx) => {
      const result = await tx.userGameAccount.updateMany({
        where: {
          id: accountId,
          userId,
          version: expectedVersion,
          deletedAt: null,
          status: { in: ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'] },
        },
        data: {
          status: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedByUserId: null,
          rejectionReasonCode: null,
          reviewMessage: null,
          suspensionReasonCode: null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new PlayerIdentityError('GAME_ACCOUNT_VERSION_CONFLICT');
      await tx.gameAccountReview.create({
        data: { gameAccountId: accountId, actorUserId: userId, action: 'SUBMIT' },
      });
      const account = await tx.userGameAccount.findFirst({
        where: { id: accountId, userId },
        select: accountSelect,
      });
      if (!account) throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
      return record(account);
    });
  }
  public async softDeleteGameAccount(
    userId: string,
    accountId: string,
    expectedVersion: number,
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const result = await tx.userGameAccount.updateMany({
        where: { id: accountId, userId, version: expectedVersion, deletedAt: null },
        data: { deletedAt: new Date(), isPrimary: false, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new PlayerIdentityError('GAME_ACCOUNT_VERSION_CONFLICT');
      await tx.gameAccountReview.create({
        data: { gameAccountId: accountId, actorUserId: userId, action: 'DELETE' },
      });
    });
  }
  public async restoreDeletedGameAccount(
    userId: string,
    accountId: string,
    expectedVersion: number,
  ): Promise<UserGameAccountRecord> {
    return this.client.$transaction(async (tx) => {
      const result = await tx.userGameAccount.updateMany({
        where: { id: accountId, userId, version: expectedVersion, deletedAt: { not: null } },
        data: { deletedAt: null, status: 'DRAFT', version: { increment: 1 } },
      });
      if (result.count !== 1) throw new PlayerIdentityError('GAME_ACCOUNT_VERSION_CONFLICT');
      await tx.gameAccountReview.create({
        data: { gameAccountId: accountId, actorUserId: userId, action: 'RESTORE_BY_USER' },
      });
      const account = await tx.userGameAccount.findFirst({
        where: { id: accountId, userId },
        select: accountSelect,
      });
      if (!account) throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
      return record(account);
    });
  }
  public async transitionUserAccount(
    userId: string,
    accountId: string,
    status: GameAccountStatus,
  ): Promise<void> {
    try {
      await this.client.$transaction(async (tx) => {
        const updated = await tx.userGameAccount.updateMany({
          where: { id: accountId, userId, deletedAt: null },
          data: { status, isPrimary: false, ...statusDates(status, new Date()) },
        });
        if (updated.count !== 1) throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
        await tx.gameAccountReview.create({
          data: { gameAccountId: accountId, actorUserId: userId, action: 'DISCONNECT' },
        });
      });
    } catch (error) {
      persistenceError(error);
    }
  }
  public async setPrimaryGameAccount(
    userId: string,
    accountId: string,
    gameId: string,
  ): Promise<void> {
    try {
      await this.client.$transaction(async (tx) => {
        await tx.userGameAccount.updateMany({
          where: { userId, gameId, isPrimary: true, deletedAt: null },
          data: { isPrimary: false },
        });
        await tx.userGameAccount.update({
          where: { id: accountId, userId, gameId, status: 'VERIFIED', deletedAt: null },
          data: { isPrimary: true },
        });
        await tx.gameAccountReview.create({
          data: { gameAccountId: accountId, actorUserId: userId, action: 'PRIMARY_CHANGE' },
        });
      });
    } catch (error) {
      persistenceError(error);
    }
  }
  public async resubmitRejectedAccount(
    userId: string,
    accountId: string,
    handle?: CreateClaimRecord,
  ): Promise<UserGameAccountRecord> {
    try {
      return await this.client.$transaction(async (tx) => {
        const updated = await tx.userGameAccount.update({
          where: {
            id: accountId,
            userId,
            status: { in: ['REJECTED', 'CHANGES_REQUESTED'] },
            deletedAt: null,
          },
          data: {
            status: 'PENDING',
            verificationMethod: 'UNVERIFIED',
            verificationMetadata: Prisma.JsonNull,
            rejectedAt: null,
            ...(handle
              ? {
                  handle: handle.handle,
                  normalizedHandle: handle.normalizedHandle,
                  displayHandle: handle.displayHandle,
                }
              : {}),
          },
          select: accountSelect,
        });
        await tx.gameAccountReview.create({
          data: { gameAccountId: accountId, actorUserId: userId, action: 'SUBMIT' },
        });
        return record(updated);
      });
    } catch (error) {
      return persistenceError(error);
    }
  }
  public async listAccountsForAdmin(query: AdminGameAccountQuery): Promise<AdminGameAccountPage> {
    const userSearch = query.userSearch?.trim();
    const externalId = query.externalId?.trim();
    const where: Prisma.UserGameAccountWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.gameId ? { gameId: query.gameId } : {}),
      ...(query.platformId ? { gamePlatform: { platformId: query.platformId } } : {}),
      ...(query.reviewerUserId ? { reviewedByUserId: query.reviewerUserId } : {}),
      ...(query.submittedFrom || query.submittedTo
        ? {
            submittedAt: {
              ...(query.submittedFrom ? { gte: query.submittedFrom } : {}),
              ...(query.submittedTo ? { lt: query.submittedTo } : {}),
            },
          }
        : {}),
      ...(query.recentlyChanged
        ? { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        : {}),
      ...(userSearch
        ? {
            OR: [
              { displayHandle: { contains: userSearch, mode: 'insensitive' } },
              { normalizedHandle: { contains: userSearch.toLowerCase(), mode: 'insensitive' } },
              { user: { profile: { displayName: { contains: userSearch, mode: 'insensitive' } } } },
              ...(zUuid(userSearch) ? [{ userId: userSearch }] : []),
            ],
          }
        : {}),
      ...(externalId
        ? {
            AND: [
              {
                OR: [
                  { displayHandle: { contains: externalId, mode: 'insensitive' } },
                  { normalizedHandle: { contains: externalId.toLowerCase(), mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.client.$transaction([
      this.client.userGameAccount.count({ where }),
      this.client.userGameAccount.findMany({
        where,
        select: adminAccountSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(adminRecord),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
  public async applyAdminReview(input: AdminReviewInput, status: GameAccountStatus): Promise<void> {
    try {
      const now = new Date();
      await this.client.$transaction(async (tx) => {
        const updated = await tx.userGameAccount.updateMany({
          where: { id: input.accountId, version: input.expectedVersion, deletedAt: null },
          data: {
            status,
            ...(status === 'VERIFIED' ? { verificationMethod: 'MANUAL' as const } : {}),
            ...(status === 'VERIFIED' ? {} : { isPrimary: false }),
            ...statusDates(status, now),
            reviewedAt: now,
            reviewedByUserId: input.actorUserId,
            rejectionReasonCode:
              status === 'REJECTED' || status === 'CHANGES_REQUESTED'
                ? (input.reasonCode ?? null)
                : null,
            reviewMessage: input.userMessage ?? null,
            suspensionReasonCode: status === 'SUSPENDED' ? (input.reasonCode ?? null) : null,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new PlayerIdentityError('GAME_ACCOUNT_VERSION_CONFLICT');
        await tx.gameAccountReview.create({
          data: {
            gameAccountId: input.accountId,
            actorUserId: input.actorUserId,
            action: input.action,
            ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
            ...(input.note === undefined ? {} : { note: input.note }),
          },
        });
      });
    } catch (error) {
      if (error instanceof PlayerIdentityError) throw error;
      persistenceError(error);
    }
  }
  public listReviews(accountId: string): Promise<readonly GameAccountReview[]> {
    return this.client.gameAccountReview.findMany({
      where: { gameAccountId: accountId },
      select: {
        id: true,
        gameAccountId: true,
        actorUserId: true,
        action: true,
        reasonCode: true,
        note: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
}
