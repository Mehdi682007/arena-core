import { describe, expect, it } from 'vitest';
import { LeaderboardService, RatingError, type RatingRepository } from '../src';

describe('leaderboard service', () => {
  it('resolves a crossplay scope and bounds pagination without exposing identities', async () => {
    const repository = {
      resolveScope: async () => ({
        gameId: 'game',
        gameModeId: 'mode',
        crossplayGroupId: 'group',
        policyKey: 'ELO',
        policyVersion: 1,
      }),
      listLeaderboard: async (query: { limit: number }) => ({
        items: [
          {
            rank: 1,
            player: { displayName: 'Player', gameHandle: 'ArenaPlayer' },
            rating: 1020,
            matchesPlayed: 1,
            wins: 1,
            losses: 0,
            draws: 0,
          },
        ],
        nextCursor: query.limit === 100 ? 'next' : null,
      }),
    } as unknown as RatingRepository;
    const page = await new LeaderboardService(repository, 1).list(
      'fc-26',
      'one-v-one',
      'current-gen',
      undefined,
      500,
    );
    expect(page.items[0]).toEqual({
      rank: 1,
      player: { displayName: 'Player', gameHandle: 'ArenaPlayer' },
      rating: 1020,
      matchesPlayed: 1,
      wins: 1,
      losses: 0,
      draws: 0,
    });
    expect(JSON.stringify(page)).not.toMatch(/userId|normalizedHandle|opponent/);
  });

  it('rejects an unknown scope', async () => {
    const repository = { resolveScope: async () => null } as unknown as RatingRepository;
    await expect(
      new LeaderboardService(repository, 1).list('unknown', 'mode', undefined, undefined, 10),
    ).rejects.toBeInstanceOf(RatingError);
  });
});
