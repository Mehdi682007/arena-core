import { describe, expect, it, vi } from 'vitest';
import type { ArenaPrismaClient } from '@arena-core/database';
import { PrismaPlayerGameAccountRepository } from '../src';

describe('Prisma player game account repository', () => {
  it('applies one backend filter to count and deterministic bounded pagination', async () => {
    const count = vi.fn<(query: { where: unknown }) => Promise<number>>(async () => 0);
    const findMany = vi.fn<
      (query: { where: unknown; skip: number; take: number; orderBy: unknown }) => Promise<never[]>
    >(async () => []);
    const transaction = vi.fn(async (operations: readonly Promise<unknown>[]) =>
      Promise.all(operations),
    );
    const repository = new PrismaPlayerGameAccountRepository({
      userGameAccount: { count, findMany },
      $transaction: transaction,
    } as unknown as ArenaPrismaClient);
    const result = await repository.listAccountsForAdmin({
      page: 2,
      pageSize: 25,
      status: 'PENDING',
      gameId: '00000000-0000-4000-8000-000000000001',
      platformId: '00000000-0000-4000-8000-000000000002',
      reviewerUserId: '00000000-0000-4000-8000-000000000003',
      submittedFrom: new Date('2026-08-01T00:00:00.000Z'),
      submittedTo: new Date('2026-08-02T00:00:00.000Z'),
      userSearch: 'Player',
      externalId: 'EA-123',
    });
    expect(count.mock.calls[0]?.[0].where).toEqual(findMany.mock.calls[0]?.[0].where);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result).toMatchObject({ page: 2, pageSize: 25, total: 0, totalPages: 1 });
  });
  it('uses ownership-scoped explicit selects', async () => {
    const findFirst = vi.fn(async () => null);
    const client = {
      userGameAccount: { findFirst },
    } as unknown as ArenaPrismaClient;
    await new PrismaPlayerGameAccountRepository(client).findUserGameAccount('user-1', 'account-1');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'account-1', userId: 'user-1' },
        select: expect.objectContaining({
          normalizedHandle: true,
          game: expect.any(Object),
          gamePlatform: expect.any(Object),
        }),
      }),
    );
  });
  it('validates GamePlatform membership with both game and platform ids', async () => {
    const findFirst = vi.fn(async () => null);
    const client = { gamePlatform: { findFirst } } as unknown as ArenaPrismaClient;
    await new PrismaPlayerGameAccountRepository(client).findGamePlatformForClaim('game-1', 'gp-1');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'gp-1', gameId: 'game-1' } }),
    );
  });
  it('creates draft unverified non-primary claims with no external credentials', async () => {
    const create = vi.fn(async () => {
      throw new Error('stop after argument capture');
    });
    const transaction = vi.fn(async (operation: (tx: unknown) => unknown) =>
      operation({ userGameAccount: { create }, gameAccountReview: { create: vi.fn() } }),
    );
    const client = { $transaction: transaction } as unknown as ArenaPrismaClient;
    await expect(
      new PrismaPlayerGameAccountRepository(client).createGameAccountClaim({
        userId: 'u',
        gameId: 'g',
        gamePlatformId: 'gp',
        handle: 'Player',
        normalizedHandle: 'player',
        displayHandle: 'Player',
      }),
    ).rejects.toMatchObject({ code: 'GAME_ACCOUNT_PERSISTENCE_FAILURE' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          verificationMethod: 'UNVERIFIED',
        }),
      }),
    );
    expect(JSON.stringify(create.mock.calls)).not.toMatch(/accessToken|refreshToken|oauth/i);
  });
  it('commits account creation and its audit in one transaction', async () => {
    const row = {
      id: 'account-1',
      userId: 'user-1',
      gameId: 'game-1',
      gamePlatformId: 'gp-1',
      handle: 'Player',
      normalizedHandle: 'player',
      displayHandle: 'Player',
      status: 'DRAFT',
      verificationMethod: 'UNVERIFIED',
      isPrimary: false,
      submittedAt: null,
      reviewedAt: null,
      reviewedByUserId: null,
      verifiedAt: null,
      rejectionReasonCode: null,
      reviewMessage: null,
      suspensionReasonCode: null,
      version: 1,
      deletedAt: null,
      createdAt: new Date(),
      game: {},
      gamePlatform: { platform: {} },
    };
    const accountCreate = vi.fn(async () => row);
    const auditCreate = vi.fn(async () => ({}));
    const transaction = vi.fn(async (operation: (tx: unknown) => unknown) =>
      operation({
        userGameAccount: { create: accountCreate },
        gameAccountReview: { create: auditCreate },
      }),
    );
    const repository = new PrismaPlayerGameAccountRepository({
      $transaction: transaction,
    } as unknown as ArenaPrismaClient);
    await repository.createGameAccountClaim({
      userId: 'user-1',
      gameId: 'game-1',
      gamePlatformId: 'gp-1',
      handle: 'Player',
      normalizedHandle: 'player',
      displayHandle: 'Player',
    });
    expect(transaction).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledWith({
      data: { gameAccountId: 'account-1', actorUserId: 'user-1', action: 'CREATE' },
    });
  });
  it('fails the transaction when audit persistence fails', async () => {
    const transaction = vi.fn(async (operation: (tx: unknown) => unknown) =>
      operation({
        userGameAccount: { create: vi.fn(async () => ({ id: 'account-1' })) },
        gameAccountReview: {
          create: vi.fn(async () => {
            throw new Error('audit failed');
          }),
        },
      }),
    );
    const repository = new PrismaPlayerGameAccountRepository({
      $transaction: transaction,
    } as unknown as ArenaPrismaClient);
    await expect(
      repository.createGameAccountClaim({
        userId: 'user-1',
        gameId: 'game-1',
        gamePlatformId: 'gp-1',
        handle: 'Player',
        normalizedHandle: 'player',
        displayHandle: 'Player',
      }),
    ).rejects.toMatchObject({ code: 'GAME_ACCOUNT_PERSISTENCE_FAILURE' });
    expect(transaction).toHaveBeenCalledOnce();
  });
});
