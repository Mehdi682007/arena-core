import { RatingError } from '../domain/rating-errors';
import type { RatingRepository } from '../ports/rating-repository';

export class LeaderboardService {
  public constructor(
    private readonly repository: RatingRepository,
    private readonly minimumMatchesPlayed: number,
  ) {}

  public async list(
    gameKey: string,
    modeKey: string,
    crossplayGroupKey: string | undefined,
    cursor: string | undefined,
    limit: number,
  ) {
    const scope = await this.repository.resolveScope(gameKey, modeKey, crossplayGroupKey);
    if (!scope) throw new RatingError('RATING_NOT_FOUND');
    return this.repository.listLeaderboard({
      ...scope,
      ...(cursor ? { cursor } : {}),
      limit: Math.min(Math.max(limit, 1), 100),
      minimumMatchesPlayed: this.minimumMatchesPlayed,
    });
  }

  public async myRank(
    userId: string,
    gameKey: string,
    modeKey: string,
    crossplayGroupKey?: string,
  ) {
    const scope = await this.repository.resolveScope(gameKey, modeKey, crossplayGroupKey);
    if (!scope) throw new RatingError('RATING_NOT_FOUND');
    return {
      rank: await this.repository.getMyRank(userId, scope, this.minimumMatchesPlayed),
    };
  }
}
