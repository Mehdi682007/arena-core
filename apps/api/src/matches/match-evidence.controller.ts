import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import type { MatchEvidenceService } from '@arena-core/matches';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  emptyMatchActionSchema,
  evidenceIdSchema,
  matchIdSchema,
  submitEvidenceSchema,
} from './matches.dto';
import { MATCH_EVIDENCE_SERVICE } from './matches.providers';

@Controller('matches/:matchId/evidence')
export class MatchEvidenceController {
  public constructor(
    @Inject(MATCH_EVIDENCE_SERVICE) private readonly service: MatchEvidenceService,
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
  public submit(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(submitEvidenceSchema)) body: { evidence: unknown },
  ) {
    return this.service.submit(principal.userId, matchId, body.evidence);
  }

  @Post(':evidenceId/withdraw')
  @RateLimit('matches')
  @HttpCode(HttpStatus.NO_CONTENT)
  public withdraw(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Param('evidenceId', new ZodBodyPipe(evidenceIdSchema)) evidenceId: string,
    @Body(new ZodBodyPipe(emptyMatchActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.service.withdraw(principal.userId, matchId, evidenceId);
  }
}
