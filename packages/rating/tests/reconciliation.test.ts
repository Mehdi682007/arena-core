import { describe, expect, it } from 'vitest';
import { RatingReconciliationService, type RatingRepository } from '../src';

describe('rating reconciliation', () => {
  it('replays history without mutating persistence and reports drift', async () => {
    const repo = {
      reconcilePlayerRating: async () => ({
        rating: {
          id: 'rating',
          userId: 'user',
          gameId: 'game',
          gameModeId: 'mode',
          crossplayGroupId: 'group',
          policyKey: 'ELO',
          policyVersion: 1,
          rating: 999,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          provisionalMatchesPlayed: 0,
          highestRating: 1000,
          lowestRating: 999,
          lastMatchId: null,
          version: 1,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        changes: [
          {
            id: 'change',
            playerRatingId: 'rating',
            matchId: 'match',
            matchResultId: 'result',
            userId: 'user',
            opponentUserId: 'other',
            outcome: 'WIN',
            ratingBefore: 1000,
            ratingAfter: 1020,
            ratingDelta: 20,
            opponentRatingBefore: 1000,
            policyKey: 'ELO',
            policyVersion: 1,
            calculationSnapshot: {} as never,
            appliedAt: new Date(1),
            reversedAt: null,
            version: 1,
            createdAt: new Date(1),
          },
        ],
      }),
    } as unknown as RatingRepository;
    const result = await new RatingReconciliationService(repo).reconcile('rating');
    expect(result).toMatchObject({
      consistent: false,
      derivedRating: 1020,
      derivedMatchesPlayed: 1,
      derivedWins: 1,
    });
  });
});
