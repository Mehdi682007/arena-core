import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import type { MatchmakingProposalService } from '@arena-core/matchmaking';
import type { MatchCreationService } from '@arena-core/matches';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import { emptyMatchmakingActionSchema, matchmakingIdSchema } from './matchmaking.dto';
import { MATCHMAKING_PROPOSAL_SERVICE } from './matchmaking.providers';
import { MATCH_CREATION_SERVICE } from '../matches/matches.providers';

@Controller('matchmaking/proposals')
export class MatchmakingProposalController {
  public constructor(
    @Inject(MATCHMAKING_PROPOSAL_SERVICE) private readonly service: MatchmakingProposalService,
    @Inject(MATCH_CREATION_SERVICE) private readonly matchCreation: MatchCreationService,
  ) {}
  @Get('current')
  public current(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.service.currentProposal(principal.userId);
  }
  @Post(':proposalId/accept')
  @RateLimit('matchmaking')
  public async accept(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('proposalId', new ZodBodyPipe(matchmakingIdSchema)) proposalId: string,
    @Body(new ZodBodyPipe(emptyMatchmakingActionSchema)) body: Record<string, never>,
  ) {
    void body;
    const proposal = await this.service.accept(principal.userId, proposalId);
    if (proposal.status === 'ACCEPTED')
      await this.matchCreation.createMatchFromAcceptedProposal(proposalId);
    return proposal;
  }
  @Post(':proposalId/reject')
  @RateLimit('matchmaking')
  @HttpCode(HttpStatus.NO_CONTENT)
  public reject(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('proposalId', new ZodBodyPipe(matchmakingIdSchema)) proposalId: string,
    @Body(new ZodBodyPipe(emptyMatchmakingActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.service.reject(principal.userId, proposalId);
  }
}
