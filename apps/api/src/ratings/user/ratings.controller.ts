import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import type { LeaderboardService, RatingService } from '@arena-core/rating';
import { CurrentPrincipal } from '../../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../../identity/http/identity-http.types';
import { ratingKeySchema, ratingListSchema } from '../ratings.dto';
import { LEADERBOARD_SERVICE, RATING_SERVICE } from '../ratings.providers';

@Controller('ratings')
export class RatingsController {
  public constructor(
    @Inject(RATING_SERVICE) private readonly ratings: RatingService,
    @Inject(LEADERBOARD_SERVICE) private readonly leaderboard: LeaderboardService,
  ) {}

  @Get()
  public list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.ratings.getMyRatings(principal.userId);
  }

  @Get(':gameKey/:modeKey')
  public detail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('gameKey', new ZodBodyPipe(ratingKeySchema)) gameKey: string,
    @Param('modeKey', new ZodBodyPipe(ratingKeySchema)) modeKey: string,
  ) {
    return this.ratings.getMyRating(principal.userId, gameKey, modeKey);
  }

  @Get(':gameKey/:modeKey/history')
  public history(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('gameKey', new ZodBodyPipe(ratingKeySchema)) gameKey: string,
    @Param('modeKey', new ZodBodyPipe(ratingKeySchema)) modeKey: string,
    @Query(new ZodBodyPipe(ratingListSchema))
    query: { cursor?: string; limit: number },
  ) {
    return this.ratings.getMyHistory(principal.userId, gameKey, modeKey, query.cursor, query.limit);
  }

  @Get(':gameKey/:modeKey/rank')
  public rank(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('gameKey', new ZodBodyPipe(ratingKeySchema)) gameKey: string,
    @Param('modeKey', new ZodBodyPipe(ratingKeySchema)) modeKey: string,
  ) {
    return this.leaderboard.myRank(principal.userId, gameKey, modeKey);
  }
}
