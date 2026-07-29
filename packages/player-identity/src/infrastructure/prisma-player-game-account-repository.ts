import { type ArenaPrismaClient, Prisma } from '@arena-core/database';
import { PlayerIdentityError } from '../domain/player-identity-errors';
import type {
  AdminReviewInput,
  ClaimableGamePlatform,
  GameAccountReview,
  GameAccountStatus,
  UserGameAccountRecord,
} from '../domain/player-identity-types';
import type {
  CreateClaimRecord,
  PlayerGameAccountRepository,
} from '../ports/player-game-account-repository';

const activeStatuses = ['PENDING', 'VERIFIED', 'SUSPENDED'] as const;
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
  verifiedAt: true,
  createdAt: true,
  game: { select: { id: true, key: true, slug: true, name: true } },
  gamePlatform: {
    select: {
      platform: { select: { id: true, key: true, slug: true, name: true } },
    },
  },
} satisfies Prisma.UserGameAccountSelect;
type AccountRow = Prisma.UserGameAccountGetPayload<{ select: typeof accountSelect }>;
function record(row: AccountRow): UserGameAccountRecord {
  return { ...row, game: row.game, platform: row.gamePlatform.platform };
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
  public async findAccountForAdmin(accountId: string): Promise<UserGameAccountRecord | null> {
    const row = await this.client.userGameAccount.findUnique({
      where: { id: accountId },
      select: accountSelect,
    });
    return row && record(row);
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
        where: { userId, gamePlatformId, status: { in: [...activeStatuses] } },
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
          status: { in: [...activeStatuses] },
        },
      })) > 0
    );
  }
  public async createGameAccountClaim(input: CreateClaimRecord): Promise<UserGameAccountRecord> {
    try {
      return record(
        await this.client.userGameAccount.create({
          data: { ...input, status: 'PENDING', verificationMethod: 'UNVERIFIED' },
          select: accountSelect,
        }),
      );
    } catch (error) {
      return persistenceError(error);
    }
  }
  public async transitionUserAccount(
    userId: string,
    accountId: string,
    status: GameAccountStatus,
  ): Promise<void> {
    try {
      await this.client.userGameAccount.updateMany({
        where: { id: accountId, userId },
        data: { status, isPrimary: false, ...statusDates(status, new Date()) },
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
          where: { userId, gameId, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.userGameAccount.update({
          where: { id: accountId, userId, gameId, status: 'VERIFIED' },
          data: { isPrimary: true },
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
      return record(
        await this.client.userGameAccount.update({
          where: { id: accountId, userId, status: 'REJECTED' },
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
        }),
      );
    } catch (error) {
      return persistenceError(error);
    }
  }
  public async listAccountsForAdmin(
    status?: GameAccountStatus,
  ): Promise<readonly UserGameAccountRecord[]> {
    const rows = await this.client.userGameAccount.findMany({
      where: status ? { status } : {},
      select: accountSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return rows.map(record);
  }
  public async applyAdminReview(input: AdminReviewInput, status: GameAccountStatus): Promise<void> {
    try {
      const now = new Date();
      await this.client.$transaction(async (tx) => {
        await tx.userGameAccount.update({
          where: { id: input.accountId },
          data: {
            status,
            ...(status === 'VERIFIED' ? { verificationMethod: 'MANUAL' as const } : {}),
            ...(status === 'VERIFIED' ? {} : { isPrimary: false }),
            ...statusDates(status, now),
          },
        });
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
