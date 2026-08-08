import { describe, expect, it, vi } from 'vitest';
import {
  AdminGameAccountVerificationService,
  PlayerGameAccountService,
  PlayerIdentityError,
  type PlayerGameAccountRepository,
  type UserGameAccountRecord,
} from '../src';

const account: UserGameAccountRecord = {
  id: 'account-1',
  userId: 'user-1',
  gameId: 'game-1',
  gamePlatformId: 'gp-1',
  handle: 'Player',
  normalizedHandle: 'player',
  displayHandle: 'Player',
  status: 'PENDING',
  verificationMethod: 'UNVERIFIED',
  isPrimary: false,
  verifiedAt: null,
  createdAt: new Date('2026-01-01'),
  game: { id: 'game-1', key: 'fc26', slug: 'fc-26', name: 'FC 26' },
  platform: { id: 'p-1', key: 'pc', slug: 'pc', name: 'PC' },
};
function repository(): PlayerGameAccountRepository {
  return {
    userCanClaim: vi.fn(async () => true),
    listUserGameAccounts: vi.fn(async () => [account]),
    listClaimableGamePlatforms: vi.fn(async () => [
      {
        game: account.game,
        platform: account.platform,
        gamePlatformId: 'gp-1',
        gameActive: true,
        gamePlatformActive: true,
      },
    ]),
    findUserGameAccount: vi.fn(async () => account),
    findAccountForAdmin: vi.fn(async () => account),
    findGamePlatformForClaim: vi.fn(async () => ({
      game: account.game,
      platform: account.platform,
      gamePlatformId: 'gp-1',
      gameActive: true,
      gamePlatformActive: true,
    })),
    hasActiveUserPlatformClaim: vi.fn(async () => false),
    hasActiveHandleClaim: vi.fn(async () => false),
    createGameAccountClaim: vi.fn(async () => account),
    transitionUserAccount: vi.fn(async () => undefined),
    setPrimaryGameAccount: vi.fn(async () => undefined),
    resubmitRejectedAccount: vi.fn(async () => account),
    listAccountsForAdmin: vi.fn(async () => [account]),
    applyAdminReview: vi.fn(async () => undefined),
    listReviews: vi.fn(async () => []),
  };
}
describe('player game account service', () => {
  it('returns only the safe claimable platform projection', async () => {
    const service = new PlayerGameAccountService(repository());

    const result = await service.listClaimableGamePlatforms();

    expect(result).toEqual([
      {
        game: account.game,
        platform: account.platform,
        gamePlatformId: 'gp-1',
      },
    ]);

    expect(result[0]).not.toHaveProperty('gameActive');
    expect(result[0]).not.toHaveProperty('gamePlatformActive');
  });
  it('creates a normalized pending claim and returns a safe projection', async () => {
    const repo = repository();
    const service = new PlayerGameAccountService(repo);
    const result = await service.createGameAccountClaim({
      userId: 'user-1',
      gameId: 'game-1',
      gamePlatformId: 'gp-1',
      handle: ' PLAYER ',
    });
    expect(repo.createGameAccountClaim).toHaveBeenCalledWith(
      expect.objectContaining({ displayHandle: 'PLAYER', normalizedHandle: 'player' }),
    );
    expect(result).not.toHaveProperty('normalizedHandle');
    expect(result).not.toHaveProperty('userId');
  });
  it('uses enumeration-safe conflict errors', async () => {
    const repo = repository();
    vi.mocked(repo.hasActiveHandleClaim).mockResolvedValue(true);
    await expect(
      new PlayerGameAccountService(repo).createGameAccountClaim({
        userId: 'user-1',
        gameId: 'game-1',
        gamePlatformId: 'gp-1',
        handle: 'Player',
      }),
    ).rejects.toMatchObject({ code: 'GAME_ACCOUNT_HANDLE_CONFLICT' });
  });
  it('requires verified status for primary', async () => {
    await expect(
      new PlayerGameAccountService(repository()).setPrimaryGameAccount('user-1', 'account-1'),
    ).rejects.toBeInstanceOf(PlayerIdentityError);
  });
});
describe('admin verification service', () => {
  it('records actor and manual verification transaction request', async () => {
    const repo = repository();
    await new AdminGameAccountVerificationService(repo).review({
      actorUserId: 'admin-1',
      accountId: 'account-1',
      action: 'VERIFY',
    });
    expect(repo.applyAdminReview).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'admin-1', action: 'VERIFY' }),
      'VERIFIED',
    );
  });
  it('requires a typed reason for rejection', async () => {
    await expect(
      new AdminGameAccountVerificationService(repository()).review({
        actorUserId: 'admin-1',
        accountId: 'account-1',
        action: 'REJECT',
      }),
    ).rejects.toMatchObject({ code: 'GAME_ACCOUNT_VERIFICATION_INVALID' });
  });
});
