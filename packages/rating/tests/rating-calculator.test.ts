import { describe, expect, it } from 'vitest';
import { calculateEloPair, RatingError, validateRatingPolicy, type RatingPolicy } from '../src';

const policy: RatingPolicy = {
  key: 'ELO',
  version: 1,
  initialRating: 1000,
  provisionalMatchCount: 10,
  provisionalKFactor: 40,
  establishedKFactor: 24,
  minimumRating: 100,
  maximumRating: 3000,
};

describe('Elo v1', () => {
  it('calculates a symmetric equal-rating win with deterministic integer rounding', () => {
    const result = calculateEloPair(
      policy,
      { rating: 1000, matchesPlayed: 0, outcome: 'WIN' },
      { rating: 1000, matchesPlayed: 0, outcome: 'LOSS' },
    );
    expect(result.participantA.ratingAfter).toBe(1020);
    expect(result.participantB.ratingAfter).toBe(980);
    expect(result.participantA.ratingDelta + result.participantB.ratingDelta).toBe(0);
    expect(
      calculateEloPair(
        policy,
        { rating: 1000, matchesPlayed: 0, outcome: 'WIN' },
        { rating: 1000, matchesPlayed: 0, outcome: 'LOSS' },
      ),
    ).toEqual(result);
  });

  it('keeps equal ratings unchanged on draw and uses established K', () => {
    const result = calculateEloPair(
      policy,
      { rating: 1000, matchesPlayed: 10, outcome: 'DRAW' },
      { rating: 1000, matchesPlayed: 10, outcome: 'DRAW' },
    );
    expect(result.participantA.ratingAfter).toBe(1000);
    expect(result.participantA.kFactor).toBe(24);
  });

  it('rewards an underdog more than a favorite and clamps bounds', () => {
    const upset = calculateEloPair(
      policy,
      { rating: 800, matchesPlayed: 0, outcome: 'WIN' },
      { rating: 1200, matchesPlayed: 0, outcome: 'LOSS' },
    );
    expect(upset.participantA.ratingDelta).toBeGreaterThan(20);
    const clamped = calculateEloPair(
      policy,
      { rating: 2999, matchesPlayed: 0, outcome: 'WIN' },
      { rating: 100, matchesPlayed: 0, outcome: 'LOSS' },
    );
    expect(clamped.participantA.ratingAfter).toBeLessThanOrEqual(3000);
    expect(clamped.participantB.ratingAfter).toBeGreaterThanOrEqual(100);
  });

  it('rejects invalid inputs and policy bounds', () => {
    expect(() =>
      calculateEloPair(
        policy,
        { rating: Number.NaN, matchesPlayed: 0, outcome: 'WIN' },
        { rating: 1000, matchesPlayed: 0, outcome: 'LOSS' },
      ),
    ).toThrow(RatingError);
    expect(() => validateRatingPolicy({ ...policy, minimumRating: 3000 })).toThrow(RatingError);
  });
});
