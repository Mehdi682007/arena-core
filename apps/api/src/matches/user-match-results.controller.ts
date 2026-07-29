import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import type { MatchResultService, MatchStartService } from '@arena-core/matches';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import { emptyMatchActionSchema, matchIdSchema, submitMatchResultSchema } from './matches.dto';
import { MATCH_RESULT_SERVICE, MATCH_START_SERVICE } from './matches.providers';

@Controller('matches/:matchId')
export class UserMatchResultsController {
  public constructor(
    @Inject(MATCH_START_SERVICE) private readonly starts: MatchStartService,
    @Inject(MATCH_RESULT_SERVICE) private readonly results: MatchResultService,
  ) {}
  @Post('start')
  @RateLimit('matches')
  public start(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(emptyMatchActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.starts.start(matchId, principal.userId);
  }
  @Post('result-submissions')
  @RateLimit('matches')
  public submit(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(submitMatchResultSchema))
    body: { result: unknown },
  ) {
    return this.results.submit(matchId, principal.userId, body.result);
  }
  @Post('result-submissions/withdraw')
  @RateLimit('matches')
  @HttpCode(HttpStatus.NO_CONTENT)
  public withdraw(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(emptyMatchActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.results.withdraw(matchId, principal.userId);
  }
  @Get('result')
  public get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
  ) {
    return this.results.get(matchId, principal.userId);
  }
}
