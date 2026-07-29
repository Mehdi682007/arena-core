import { describe, expect, it } from 'vitest';
import {
  RatingError,
  RatingService,
  type MatchRatingContext,
  type MatchRatingApplicationRecord,
  type PlayerRatingRecord,
  type RatingRepository,
} from '../src';

const now = new Date('2026-07-26T12:00:00.000Z');
const context: MatchRatingContext = {
  matchId: '11111111-1111-4111-8111-111111111111',
  matchStatus: 'COMPLETED',
  gameId: 'game',
  gameModeId: 'mode',
  crossplayGroupId: 'group',
  policyKey: 'ELO',
  policyVersion: 1,
  completedAt: new Date(now.getTime() - 90_000_000),
  settlementEligibleAt: now,
  result: {
    id: 'result',
    status: 'CONFIRMED',
    version: 1,
    winnerParticipantId: 'pa',
    loserParticipantId: 'pb',
    isDraw: false,
    confirmedAt: now,
  },
  participants: [
    { id: 'pa', userId: 'user-a' },
    { id: 'pb', userId: 'user-b' },
  ],
  activeDispute: false,
  resolvedDisputeAt: null,
};

function repository() {
  const ratings = new Map<string, PlayerRatingRecord>();
  let application: MatchRatingApplicationRecord | null = null;
  let changes = 0;
  const repo = {
    findMatchRatingContext: async () => context,
    findApplicationByMatchId: async () => application,
    findApplicationByIdempotencyKey: async (key: string) =>
      application?.idempotencyKey === key ? application : null,
    ensurePlayerRating: async (input: any) => {
      const existing = ratings.get(input.userId);
      if (existing) return existing;
      const value: PlayerRatingRecord = {
        ...input,
        rating: input.initialRating,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        provisionalMatchesPlayed: 0,
        highestRating: input.initialRating,
        lowestRating: input.initialRating,
        lastMatchId: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      ratings.set(input.userId, value);
      return value;
    },
    applyRatingChanges: async (input: any) => {
      changes = input.changes.length;
      application = {
        id: input.applicationId,
        matchId: context.matchId,
        matchResultId: context.result!.id,
        status: 'APPLIED',
        policyKey: 'ELO',
        policyVersion: 1,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        actorUserId: null,
        appliedAt: now,
        failedAt: null,
        failureCode: null,
        version: 1,
      };
      return application;
    },
  } as unknown as RatingRepository;
  return { repo, ratings, changes: () => changes };
}

const service = (repo: RatingRepository) =>
  new RatingService(
    repo,
    { transaction: async (operation) => operation(repo) },
    { now: () => now },
    { generate: () => crypto.randomUUID() },
    {
      key: 'ELO',
      version: 1,
      initialRating: 1000,
      provisionalMatchCount: 10,
      provisionalKFactor: 40,
      establishedKFactor: 24,
      minimumRating: 100,
      maximumRating: 3000,
    },
    86_400,
  );

describe('match rating application', () => {
  it('lazy-creates two ratings, persists two immutable changes, and retries exactly', async () => {
    const state = repository();
    const ratings = service(state.repo);
    const first = await ratings.applyMatchRating({
      matchId: context.matchId,
      idempotencyKey: 'rating-match-001',
      operation: 'SYSTEM',
    });
    const retry = await ratings.applyMatchRating({
      matchId: context.matchId,
      idempotencyKey: 'rating-match-001',
      operation: 'SYSTEM',
    });
    expect(retry).toEqual(first);
    expect(state.ratings.size).toBe(2);
    expect(state.changes()).toBe(2);
  });

  it('blocks an active dispute and delay window', async () => {
    const active = repository();
    active.repo.findMatchRatingContext = async () => ({ ...context, activeDispute: true });
    await expect(
      service(active.repo).applyMatchRating({
        matchId: context.matchId,
        idempotencyKey: 'rating-match-002',
        operation: 'SYSTEM',
      }),
    ).rejects.toMatchObject({ code: 'RATING_APPLICATION_ACTIVE_DISPUTE' });
    const delayed = repository();
    delayed.repo.findMatchRatingContext = async () => ({ ...context, completedAt: now });
    await expect(
      service(delayed.repo).applyMatchRating({
        matchId: context.matchId,
        idempotencyKey: 'rating-match-003',
        operation: 'SYSTEM',
      }),
    ).rejects.toBeInstanceOf(RatingError);
  });
});
