import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import type { MatchDisputeReasonCode, MatchDisputeService } from '@arena-core/matches';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  disputeIdSchema,
  emptyMatchActionSchema,
  matchIdSchema,
  openDisputeSchema,
  respondDisputeSchema,
} from './matches.dto';
import { MATCH_DISPUTE_SERVICE } from './matches.providers';

@Controller('matches/:matchId/disputes')
export class MatchDisputeController {
  public constructor(
    @Inject(MATCH_DISPUTE_SERVICE) private readonly service: MatchDisputeService,
  ) {}
  @Get()
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
  ) {
    return this.service.listMine(principal.userId, matchId);
  }
  @Post()
  @RateLimit('matches')
  public open(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(openDisputeSchema))
    body: { reasonCode: MatchDisputeReasonCode; claim: unknown },
  ) {
    return this.service.open(principal.userId, matchId, body.reasonCode, body.claim);
  }
  @Get(':disputeId')
  public get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Param('disputeId', new ZodBodyPipe(disputeIdSchema)) disputeId: string,
  ) {
    return this.service.get(principal.userId, matchId, disputeId);
  }
  @Post(':disputeId/respond')
  @RateLimit('matches')
  public respond(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Param('disputeId', new ZodBodyPipe(disputeIdSchema)) disputeId: string,
    @Body(new ZodBodyPipe(respondDisputeSchema))
    body: { statement: string; evidenceIds: string[] },
  ) {
    return this.service.respond(
      principal.userId,
      matchId,
      disputeId,
      body.statement,
      body.evidenceIds,
    );
  }
  @Post(':disputeId/cancel')
  @RateLimit('matches')
  @HttpCode(HttpStatus.NO_CONTENT)
  public cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Param('disputeId', new ZodBodyPipe(disputeIdSchema)) disputeId: string,
    @Body(new ZodBodyPipe(emptyMatchActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.service.cancel(principal.userId, matchId, disputeId);
  }
}
