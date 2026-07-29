import { describe, expect, it, vi } from 'vitest';
import type { ArenaPrismaClient } from '@arena-core/database';
import { PrismaMatchmakingRepository, type MatchmakingRequest } from '../src';

const source = {
  id: 'request-z',
  userId: 'user-z',
  userGameAccountId: 'account-z',
  gameId: 'game',
  gameModeId: 'mode',
  gameRulesetId: 'ruleset',
  gamePlatformId: 'platform',
  crossplayGroupId: 'group',
  status: 'SEARCHING',
  searchScope: 'CROSSPLAY_GROUP',
  criteria: { schemaVersion: 1, preferences: {} },
  priority: 0,
  createdAt: new Date('2026-07-25T00:00:00Z'),
  expiresAt: new Date('2026-07-25T00:15:00Z'),
  version: 2,
  accountVerified: true,
  catalogValid: true,
} satisfies MatchmakingRequest;

describe('Prisma matchmaking repository', () => {
  it('scopes request reads to the authenticated owner and explicit selects', async () => {
    const findFirst = vi.fn(async () => null);
    const client = { matchmakingRequest: { findFirst } } as unknown as ArenaPrismaClient;
    await new PrismaMatchmakingRepository(client).findRequestForUser('user-1', 'request-1');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-1', userId: 'user-1' },
        select: expect.objectContaining({ criteria: true, userGameAccount: expect.any(Object) }),
      }),
    );
  });

  it('resolves creation only through an owner-scoped account lookup', async () => {
    const findFirst = vi.fn(async () => null);
    const client = { userGameAccount: { findFirst } } as unknown as ArenaPrismaClient;
    expect(
      await new PrismaMatchmakingRepository(client).resolveCreationContext(
        'user-1',
        'account-1',
        'mode-1',
        'ruleset-1',
      ),
    ).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'account-1', userId: 'user-1' } }),
    );
  });

  it('uses a bounded deterministic candidate query with hard catalog filters', async () => {
    const findMany = vi.fn(async () => []);
    const client = { matchmakingRequest: { findMany } } as unknown as ArenaPrismaClient;
    await new PrismaMatchmakingRepository(client).listCandidateRequests(source, 50);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: source.id },
          userId: { not: source.userId },
          status: 'SEARCHING',
          gameId: 'game',
          gameModeId: 'mode',
          gameRulesetId: 'ruleset',
          crossplayGroupId: 'group',
        }),
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        take: 50,
      }),
    );
  });

  it('applies optimistic id and version predicates to request transitions', async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const client = { matchmakingRequest: { updateMany } } as unknown as ArenaPrismaClient;
    await expect(
      new PrismaMatchmakingRepository(client).transitionRequest(
        'request-1',
        7,
        'CANCELLED',
        new Date(),
      ),
    ).rejects.toMatchObject({ code: 'MATCHMAKING_CONFLICT' });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'request-1', version: 7 } }),
    );
  });

  it('canonicalizes proposal pairs before persistence', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const create = vi.fn(async () => {
      throw new Error('stop after argument capture');
    });
    const client = {
      matchmakingRequest: { updateMany },
      matchmakingProposal: { create },
    } as unknown as ArenaPrismaClient;
    const other = { ...source, id: 'request-a', userId: 'user-a' };
    await expect(
      new PrismaMatchmakingRepository(client).createProposalForPair(
        source,
        other,
        new Date('2026-07-25T00:00:30Z'),
      ),
    ).rejects.toMatchObject({ code: 'MATCHMAKING_PERSISTENCE_FAILURE' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestAId: 'request-a', requestBId: 'request-z' }),
      }),
    );
  });
});
