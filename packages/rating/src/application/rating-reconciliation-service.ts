import type { RatingOutcome } from '../domain/rating-types';
import type { RatingRepository } from '../ports/rating-repository';

export interface PlayerRatingReconciliationResult {
  readonly consistent: boolean;
  readonly storedRating: number;
  readonly derivedRating: number;
  readonly storedMatchesPlayed: number;
  readonly derivedMatchesPlayed: number;
  readonly storedWins: number;
  readonly derivedWins: number;
  readonly storedLosses: number;
  readonly derivedLosses: number;
  readonly storedDraws: number;
  readonly derivedDraws: number;
  readonly storedHighestRating: number;
  readonly derivedHighestRating: number;
  readonly storedLowestRating: number;
  readonly derivedLowestRating: number;
}

export class RatingReconciliationService {
  public constructor(private readonly repository: RatingRepository) {}

  public async reconcile(playerRatingId: string): Promise<PlayerRatingReconciliationResult | null> {
    const data = await this.repository.reconcilePlayerRating(playerRatingId);
    if (!data) return null;
    const changes = [...data.changes]
      .filter((change) => change.reversedAt === null)
      .sort((a, b) => a.appliedAt.getTime() - b.appliedAt.getTime() || a.id.localeCompare(b.id));
    const count = (outcome: RatingOutcome) =>
      changes.filter((change) => change.outcome === outcome).length;
    const ratings = [
      changes[0]?.ratingBefore ?? data.rating.rating,
      ...changes.map((change) => change.ratingAfter),
    ];
    const derived = {
      rating: changes.at(-1)?.ratingAfter ?? data.rating.rating,
      matches: changes.length,
      wins: count('WIN'),
      losses: count('LOSS'),
      draws: count('DRAW'),
      high: Math.max(...ratings),
      low: Math.min(...ratings),
    };
    const result = {
      storedRating: data.rating.rating,
      derivedRating: derived.rating,
      storedMatchesPlayed: data.rating.matchesPlayed,
      derivedMatchesPlayed: derived.matches,
      storedWins: data.rating.wins,
      derivedWins: derived.wins,
      storedLosses: data.rating.losses,
      derivedLosses: derived.losses,
      storedDraws: data.rating.draws,
      derivedDraws: derived.draws,
      storedHighestRating: data.rating.highestRating,
      derivedHighestRating: derived.high,
      storedLowestRating: data.rating.lowestRating,
      derivedLowestRating: derived.low,
    };
    return {
      consistent:
        result.storedRating === result.derivedRating &&
        result.storedMatchesPlayed === result.derivedMatchesPlayed &&
        result.storedWins === result.derivedWins &&
        result.storedLosses === result.derivedLosses &&
        result.storedDraws === result.derivedDraws &&
        result.storedHighestRating === result.derivedHighestRating &&
        result.storedLowestRating === result.derivedLowestRating,
      ...result,
    };
  }

  public async reconcileUser(userId: string) {
    const ratings = await this.repository.listForAdminUser(userId);
    const results = [];
    for (const rating of ratings)
      results.push({ playerRatingId: rating.id, result: await this.reconcile(rating.id) });
    return results;
  }
}
