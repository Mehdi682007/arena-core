import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { MatchService } from '@arena-core/matches';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import { emptyMatchActionSchema, matchIdSchema, matchListQuerySchema } from './matches.dto';
import { MATCH_SERVICE } from './matches.providers';

@Controller('matches')
export class UserMatchesController {
  public constructor(@Inject(MATCH_SERVICE) private readonly service: MatchService) {}
  @Get()
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodBodyPipe(matchListQuerySchema)) query: { limit: number },
  ) {
    return this.service.listMine(principal.userId, query.limit);
  }
  @Get(':matchId')
  public detail(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
  ) {
    return this.service.getMine(principal.userId, matchId);
  }
  @Post(':matchId/ready')
  @RateLimit('matches')
  public ready(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(emptyMatchActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.service.ready(principal.userId, matchId);
  }
  @Post(':matchId/cancel')
  @RateLimit('matches')
  @HttpCode(HttpStatus.NO_CONTENT)
  public cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(emptyMatchActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.service.cancel(principal.userId, matchId);
  }
}
