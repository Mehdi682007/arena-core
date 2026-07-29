import { describe, expect, it, vi } from 'vitest';
import type { ArenaPrismaClient } from '@arena-core/database';
import { PrismaPlayerGameAccountRepository } from '../src';

describe('Prisma player game account repository', () => {
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
  it('creates pending unverified non-primary claims with no external credentials', async () => {
    const create = vi.fn(async () => {
      throw new Error('stop after argument capture');
    });
    const client = { userGameAccount: { create } } as unknown as ArenaPrismaClient;
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
          status: 'PENDING',
          verificationMethod: 'UNVERIFIED',
        }),
      }),
    );
    expect(JSON.stringify(create.mock.calls)).not.toMatch(/accessToken|refreshToken|oauth/i);
  });
});
