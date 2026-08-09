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
  submittedAt: new Date('2026-01-01'),
  reviewedAt: null,
  reviewedByUserId: null,
  verifiedAt: null,
  rejectionReasonCode: null,
  reviewMessage: null,
  suspensionReasonCode: null,
  version: 1,
  deletedAt: null,
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
    findAccountForAdmin: vi.fn(async () => ({ ...account, ownerDisplayName: 'Player' })),
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
    updateGameAccountClaim: vi.fn(async () => account),
    submitGameAccount: vi.fn(async () => account),
    softDeleteGameAccount: vi.fn(async () => undefined),
    restoreDeletedGameAccount: vi.fn(async () => account),
    transitionUserAccount: vi.fn(async () => undefined),
    setPrimaryGameAccount: vi.fn(async () => undefined),
    resubmitRejectedAccount: vi.fn(async () => account),
    listAccountsForAdmin: vi.fn(async () => ({
      items: [{ ...account, ownerDisplayName: 'Player' }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    })),
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
  it('updates and normalizes an owned draft with optimistic concurrency', async () => {
    const repo = repository();
    vi.mocked(repo.findUserGameAccount).mockResolvedValue({ ...account, status: 'DRAFT' });
    const service = new PlayerGameAccountService(repo);

    await service.updateGameAccountClaim({
      userId: 'user-1',
      accountId: 'account-1',
      gameId: 'game-1',
      gamePlatformId: 'gp-1',
      handle: ' PLAYER ',
      expectedVersion: 3,
    });

    expect(repo.updateGameAccountClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        accountId: 'account-1',
        normalizedHandle: 'player',
        expectedVersion: 3,
        nextStatus: 'DRAFT',
      }),
    );
  });
  it('returns a verified account to pending when an identity field changes', async () => {
    const repo = repository();
    vi.mocked(repo.findUserGameAccount).mockResolvedValue({ ...account, status: 'VERIFIED' });

    await new PlayerGameAccountService(repo).updateGameAccountClaim({
      userId: 'user-1',
      accountId: 'account-1',
      gameId: 'game-1',
      gamePlatformId: 'gp-1',
      handle: 'NewPlayer',
      expectedVersion: 4,
    });

    expect(repo.updateGameAccountClaim).toHaveBeenCalledWith(
      expect.objectContaining({ nextStatus: 'PENDING', expectedVersion: 4 }),
    );
  });
  it('does not allow editing an account owned by another user', async () => {
    const repo = repository();
    vi.mocked(repo.findUserGameAccount).mockResolvedValue(null);
    await expect(
      new PlayerGameAccountService(repo).updateGameAccountClaim({
        userId: 'other-user',
        accountId: 'account-1',
        gameId: 'game-1',
        gamePlatformId: 'gp-1',
        handle: 'Player',
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'GAME_ACCOUNT_NOT_FOUND' });
    expect(repo.updateGameAccountClaim).not.toHaveBeenCalled();
  });
  it('submits a draft with the supplied version', async () => {
    const repo = repository();
    await new PlayerGameAccountService(repo).submitGameAccount('user-1', 'account-1', 2);
    expect(repo.submitGameAccount).toHaveBeenCalledWith('user-1', 'account-1', 2);
  });
  it('selects only a verified owned account as primary', async () => {
    const repo = repository();
    vi.mocked(repo.findUserGameAccount).mockResolvedValue({ ...account, status: 'VERIFIED' });
    await new PlayerGameAccountService(repo).setPrimaryGameAccount('user-1', 'account-1');
    expect(repo.setPrimaryGameAccount).toHaveBeenCalledWith('user-1', 'account-1', 'game-1');
  });
});
describe('admin verification service', () => {
  it('records actor and manual verification transaction request', async () => {
    const repo = repository();
    await new AdminGameAccountVerificationService(repo).review({
      actorUserId: 'admin-1',
      accountId: 'account-1',
      action: 'VERIFY',
      expectedVersion: 1,
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
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'GAME_ACCOUNT_VERIFICATION_INVALID' });
  });
  it('uses the account version to reject concurrent admin reviews', async () => {
    const repo = repository();
    vi.mocked(repo.applyAdminReview).mockRejectedValue(
      new PlayerIdentityError('GAME_ACCOUNT_VERSION_CONFLICT'),
    );
    await expect(
      new AdminGameAccountVerificationService(repo).review({
        actorUserId: 'admin-2',
        accountId: 'account-1',
        action: 'VERIFY',
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'GAME_ACCOUNT_VERSION_CONFLICT' });
  });
});
