import { PlayerIdentityError } from '../domain/player-identity-errors';
import { assertPrimaryEligible } from '../domain/player-identity-policies';
import { PlatformHandleNormalizerRegistry } from '../domain/platform-handle-normalizers';
import type {
  ClaimableGamePlatformView,
  UserGameAccountRecord,
  UserGameAccountView,
} from '../domain/player-identity-types';
import type { PlayerGameAccountRepository } from '../ports/player-game-account-repository';

function safe(record: UserGameAccountRecord): UserGameAccountView {
  const {
    userId,
    gameId,
    handle,
    normalizedHandle,
    verificationMethod,
    reviewedByUserId,
    ...view
  } = record;

  void userId;
  void gameId;
  void handle;
  void normalizedHandle;
  void verificationMethod;
  void reviewedByUserId;

  return view;
}

export class PlayerGameAccountService {
  public constructor(
    private readonly repository: PlayerGameAccountRepository,
    private readonly normalizers = new PlatformHandleNormalizerRegistry(),
  ) {}

  public async listClaimableGamePlatforms(): Promise<readonly ClaimableGamePlatformView[]> {
    const platforms = await this.repository.listClaimableGamePlatforms();

    return platforms
      .filter((item) => item.gameActive && item.gamePlatformActive)
      .map((item) =>
        Object.freeze({
          game: item.game,
          platform: item.platform,
          gamePlatformId: item.gamePlatformId,
        }),
      );
  }

  public async listMyGameAccounts(userId: string): Promise<readonly UserGameAccountView[]> {
    return (await this.repository.listUserGameAccounts(userId)).map(safe);
  }

  public async getMyGameAccount(userId: string, accountId: string): Promise<UserGameAccountView> {
    const account = await this.repository.findUserGameAccount(userId, accountId);

    if (!account) {
      throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
    }

    return safe(account);
  }

  public async createGameAccountClaim(input: {
    userId: string;
    gameId: string;
    gamePlatformId: string;
    handle: string;
  }): Promise<UserGameAccountView> {
    if (!(await this.repository.userCanClaim(input.userId))) {
      throw new PlayerIdentityError('GAME_ACCOUNT_PERMISSION_DENIED');
    }

    const catalog = await this.repository.findGamePlatformForClaim(
      input.gameId,
      input.gamePlatformId,
    );

    if (!catalog?.gameActive || !catalog.gamePlatformActive) {
      throw new PlayerIdentityError('GAME_ACCOUNT_PLATFORM_INVALID');
    }

    const normalized = this.normalizers.forPlatform(catalog.platform.key).normalize(input.handle);

    if (
      (await this.repository.hasActiveUserPlatformClaim(input.userId, input.gamePlatformId)) ||
      (await this.repository.hasActiveHandleClaim(input.gamePlatformId, normalized.normalized))
    ) {
      throw new PlayerIdentityError('GAME_ACCOUNT_HANDLE_CONFLICT');
    }

    const created = await this.repository.createGameAccountClaim({
      ...input,
      handle: normalized.display,
      displayHandle: normalized.display,
      normalizedHandle: normalized.normalized,
    });
    return safe(created);
  }

  public async updateGameAccountClaim(input: {
    userId: string;
    accountId: string;
    gameId: string;
    gamePlatformId: string;
    handle: string;
    expectedVersion: number;
  }): Promise<UserGameAccountView> {
    const current = await this.repository.findUserGameAccount(input.userId, input.accountId);
    if (!current) throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
    if (!['DRAFT', 'CHANGES_REQUESTED', 'VERIFIED'].includes(current.status)) {
      throw new PlayerIdentityError('GAME_ACCOUNT_STATUS_TRANSITION_INVALID');
    }
    const catalog = await this.repository.findGamePlatformForClaim(
      input.gameId,
      input.gamePlatformId,
    );
    if (!catalog?.gameActive || !catalog.gamePlatformActive) {
      throw new PlayerIdentityError('GAME_ACCOUNT_PLATFORM_INVALID');
    }
    const normalized = this.normalizers.forPlatform(catalog.platform.key).normalize(input.handle);
    const updated = await this.repository.updateGameAccountClaim({
      ...input,
      handle: normalized.display,
      displayHandle: normalized.display,
      normalizedHandle: normalized.normalized,
      nextStatus:
        current.status === 'VERIFIED'
          ? 'PENDING'
          : current.status === 'CHANGES_REQUESTED'
            ? 'CHANGES_REQUESTED'
            : 'DRAFT',
    });
    return safe(updated);
  }

  public async submitGameAccount(userId: string, accountId: string, expectedVersion: number) {
    const submitted = await this.repository.submitGameAccount(userId, accountId, expectedVersion);
    return safe(submitted);
  }

  public async deleteGameAccount(userId: string, accountId: string, expectedVersion: number) {
    await this.repository.softDeleteGameAccount(userId, accountId, expectedVersion);
  }

  public async restoreGameAccount(userId: string, accountId: string, expectedVersion: number) {
    const restored = await this.repository.restoreDeletedGameAccount(
      userId,
      accountId,
      expectedVersion,
    );
    return safe(restored);
  }

  public async disconnectMyGameAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.repository.findUserGameAccount(userId, accountId);

    if (!account) {
      throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
    }

    if (account.status === 'DISCONNECTED') {
      return;
    }

    await this.repository.transitionUserAccount(userId, accountId, 'DISCONNECTED');
  }

  public async setPrimaryGameAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.repository.findUserGameAccount(userId, accountId);

    if (!account) {
      throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
    }

    assertPrimaryEligible(account.status);

    if (account.isPrimary) {
      return;
    }

    await this.repository.setPrimaryGameAccount(userId, accountId, account.gameId);
  }

  public async resubmitRejectedGameAccount(
    userId: string,
    accountId: string,
  ): Promise<UserGameAccountView> {
    const account = await this.repository.findUserGameAccount(userId, accountId);

    if (!account) {
      throw new PlayerIdentityError('GAME_ACCOUNT_NOT_FOUND');
    }

    if (account.status !== 'REJECTED' && account.status !== 'CHANGES_REQUESTED') {
      throw new PlayerIdentityError('GAME_ACCOUNT_STATUS_TRANSITION_INVALID');
    }

    const submitted = await this.repository.resubmitRejectedAccount(userId, accountId);
    return safe(submitted);
  }
}
