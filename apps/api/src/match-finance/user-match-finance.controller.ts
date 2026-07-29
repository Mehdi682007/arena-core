import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import type { MatchEntryReservationService } from '@arena-core/match-finance';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  matchFinanceListSchema,
  matchFinanceMatchIdSchema,
  reserveMatchEntrySchema,
} from './match-finance.dto';
import { MATCH_ENTRY_RESERVATION_SERVICE } from './match-finance.providers';

@Controller()
export class UserMatchFinanceController {
  public constructor(
    @Inject(MATCH_ENTRY_RESERVATION_SERVICE)
    private readonly service: MatchEntryReservationService,
  ) {}
  @Get('matches/:matchId/entry-reservation')
  public get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchFinanceMatchIdSchema)) matchId: string,
  ) {
    return this.service.getMine(principal.userId, matchId);
  }
  @Post('matches/:matchId/entry-reservation')
  @RateLimit('matches')
  public reserve(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchFinanceMatchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(reserveMatchEntrySchema)) body: { idempotencyKey: string },
  ) {
    return this.service.reserve({ matchId, userId: principal.userId, ...body });
  }
  @Get('match-entry-reservations')
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodBodyPipe(matchFinanceListSchema)) query: { limit: number },
  ) {
    return this.service.listMine(principal.userId, query.limit);
  }
}
