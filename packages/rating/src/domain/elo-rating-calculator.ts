import { RatingError } from './rating-errors';
import { kFactor, validateRatingPolicy, type RatingPolicy } from './rating-policy';

export type ScoredOutcome = 'WIN' | 'LOSS' | 'DRAW';

export interface EloParticipantResult {
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly ratingDelta: number;
  readonly expectedScore: number;
  readonly actualScore: number;
  readonly kFactor: number;
}

export interface EloPairResult {
  readonly participantA: EloParticipantResult;
  readonly participantB: EloParticipantResult;
}

const actualScore = (outcome: ScoredOutcome): number =>
  outcome === 'WIN' ? 1 : outcome === 'LOSS' ? 0 : 0.5;

function assertRating(policy: RatingPolicy, rating: number, matchesPlayed: number): void {
  if (
    !Number.isSafeInteger(rating) ||
    rating < policy.minimumRating ||
    rating > policy.maximumRating ||
    !Number.isSafeInteger(matchesPlayed) ||
    matchesPlayed < 0
  )
    throw new RatingError('RATING_INVARIANT_VIOLATION');
}

export function calculateEloPair(
  policyInput: RatingPolicy,
  participantA: Readonly<{ rating: number; matchesPlayed: number; outcome: ScoredOutcome }>,
  participantB: Readonly<{ rating: number; matchesPlayed: number; outcome: ScoredOutcome }>,
): EloPairResult {
  const policy = validateRatingPolicy(policyInput);
  assertRating(policy, participantA.rating, participantA.matchesPlayed);
  assertRating(policy, participantB.rating, participantB.matchesPlayed);
  const scoreA = actualScore(participantA.outcome);
  const scoreB = actualScore(participantB.outcome);
  if (Math.abs(scoreA + scoreB - 1) > Number.EPSILON)
    throw new RatingError('RATING_APPLICATION_RESULT_INVALID');
  const expectedA = 1 / (1 + 10 ** ((participantB.rating - participantA.rating) / 400));
  const expectedB = 1 - expectedA;
  const make = (
    rating: number,
    matchesPlayed: number,
    score: number,
    expected: number,
  ): EloParticipantResult => {
    const factor = kFactor(policy, matchesPlayed);
    const raw = rating + factor * (score - expected);
    const ratingAfter = Math.min(
      policy.maximumRating,
      Math.max(policy.minimumRating, Math.round(raw)),
    );
    return Object.freeze({
      ratingBefore: rating,
      ratingAfter,
      ratingDelta: ratingAfter - rating,
      expectedScore: expected,
      actualScore: score,
      kFactor: factor,
    });
  };
  return Object.freeze({
    participantA: make(participantA.rating, participantA.matchesPlayed, scoreA, expectedA),
    participantB: make(participantB.rating, participantB.matchesPlayed, scoreB, expectedB),
  });
}
