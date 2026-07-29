import { RatingError } from './rating-errors';

export interface RatingPolicy {
  readonly key: 'ELO';
  readonly version: 1;
  readonly initialRating: number;
  readonly provisionalMatchCount: number;
  readonly provisionalKFactor: number;
  readonly establishedKFactor: number;
  readonly minimumRating: number;
  readonly maximumRating: number;
}

export function validateRatingPolicy(policy: RatingPolicy): RatingPolicy {
  const integers = [
    policy.initialRating,
    policy.provisionalMatchCount,
    policy.provisionalKFactor,
    policy.establishedKFactor,
    policy.minimumRating,
    policy.maximumRating,
  ];
  if (
    integers.some((value) => !Number.isSafeInteger(value)) ||
    policy.minimumRating < 0 ||
    policy.maximumRating > 10_000 ||
    policy.minimumRating >= policy.maximumRating ||
    policy.initialRating < policy.minimumRating ||
    policy.initialRating > policy.maximumRating ||
    policy.provisionalMatchCount < 0 ||
    policy.provisionalMatchCount > 100 ||
    policy.provisionalKFactor < 1 ||
    policy.provisionalKFactor > 200 ||
    policy.establishedKFactor < 1 ||
    policy.establishedKFactor > policy.provisionalKFactor
  ) {
    throw new RatingError('RATING_POLICY_INVALID');
  }
  return Object.freeze({ ...policy });
}

export function kFactor(policy: RatingPolicy, matchesPlayed: number): number {
  return matchesPlayed < policy.provisionalMatchCount
    ? policy.provisionalKFactor
    : policy.establishedKFactor;
}
