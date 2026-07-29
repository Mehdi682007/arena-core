import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import type { MatchSettlementService } from '@arena-core/match-finance';
import { CurrentPrincipal } from '../../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../../identity/http/identity-http.types';
import { MATCH_SETTLEMENT_SERVICE } from '../match-finance.providers';
import { settlementListSchema, settlementMatchIdSchema } from './match-settlement.dto';
@Controller()
export class MatchSettlementController {
  public constructor(
    @Inject(MATCH_SETTLEMENT_SERVICE) private readonly service: MatchSettlementService,
  ) {}
  @Get('matches/:matchId/settlement')
  public get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(settlementMatchIdSchema)) matchId: string,
  ) {
    return this.service.getMine(principal.userId, matchId);
  }
  @Get('match-settlements')
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodBodyPipe(settlementListSchema)) query: { limit: number },
  ) {
    return this.service.listMine(principal.userId, query.limit);
  }
}
