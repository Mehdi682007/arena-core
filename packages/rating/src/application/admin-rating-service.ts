import type { RatingRepository } from '../ports/rating-repository';
import type { RatingService } from './rating-service';

export class AdminRatingService {
  public constructor(
    private readonly ratings: RatingService,
    private readonly repository: RatingRepository,
  ) {}

  public list(limit: number) {
    return this.repository.listAdmin(Math.min(Math.max(limit, 1), 100));
  }

  public listUser(userId: string) {
    return this.repository.listForAdminUser(userId);
  }

  public match(matchId: string) {
    return this.repository.findMatchRatingContext(matchId);
  }

  public apply(matchId: string, idempotencyKey: string, actorUserId: string) {
    return this.ratings.applyMatchRating({
      matchId,
      idempotencyKey,
      operation: 'ADMIN_RETRY',
      actorUserId,
    });
  }

  public async recoverEligible(now: Date, limit: number) {
    const matches = await this.repository.listEligibleMatches(now, Math.min(limit, 100));
    const results = [];
    for (const matchId of matches)
      results.push(
        await this.ratings.applyMatchRating({
          matchId,
          idempotencyKey: `recovery:${matchId}`,
          operation: 'SYSTEM',
        }),
      );
    return results;
  }
}
