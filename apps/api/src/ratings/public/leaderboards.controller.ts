import { Controller, Get, Inject, Param, Query, Res } from '@nestjs/common';
import type { LeaderboardService } from '@arena-core/rating';
import { Public } from '../../identity/http/decorators/public.decorator';
import { ZodBodyPipe } from '../../identity/http/dto/identity.dto';
import { RateLimit } from '../../identity/http/rate-limit.interceptor';
import { leaderboardQuerySchema, ratingKeySchema } from '../ratings.dto';
import { LEADERBOARD_SERVICE } from '../ratings.providers';

@Public()
@Controller('leaderboards')
export class LeaderboardsController {
  public constructor(
    @Inject(LEADERBOARD_SERVICE) private readonly leaderboard: LeaderboardService,
  ) {}

  @Get(':gameKey/:modeKey')
  @RateLimit('token')
  public list(
    @Param('gameKey', new ZodBodyPipe(ratingKeySchema)) gameKey: string,
    @Param('modeKey', new ZodBodyPipe(ratingKeySchema)) modeKey: string,
    @Query(new ZodBodyPipe(leaderboardQuerySchema))
    query: { crossplayGroup?: string; cursor?: string; limit: number },
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ) {
    response.setHeader('Cache-Control', 'public, max-age=30');
    response.setHeader('Pragma', '');
    return this.leaderboard.list(gameKey, modeKey, query.crossplayGroup, query.cursor, query.limit);
  }
}
