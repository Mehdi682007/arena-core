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
  const { userId, gameId, gamePlatformId, handle, normalizedHandle, verificationMethod, ...view } =
    record;

  void userId;
  void gameId;
  void gamePlatformId;
  void handle;
  void normalizedHandle;
  void verificationMethod;

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

    return safe(
      await this.repository.createGameAccountClaim({
        ...input,
        handle: normalized.display,
        displayHandle: normalized.display,
        normalizedHandle: normalized.normalized,
      }),
    );
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

    if (account.status !== 'REJECTED') {
      throw new PlayerIdentityError('GAME_ACCOUNT_STATUS_TRANSITION_INVALID');
    }

    return safe(await this.repository.resubmitRejectedAccount(userId, accountId));
  }
}
