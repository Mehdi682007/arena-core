import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AdminMatchSettlementService,
  MatchSettlementReconciliationService,
} from '@arena-core/match-finance';
import { CurrentPrincipal } from '../../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../../identity/http/identity-http.types';
import { RateLimit } from '../../identity/http/rate-limit.interceptor';
import {
  MatchFinancePermissionGuard,
  RequireMatchFinancePermission,
} from '../match-finance-permission.guard';
import {
  ADMIN_MATCH_SETTLEMENT_SERVICE,
  MATCH_SETTLEMENT_RECONCILIATION_SERVICE,
} from '../match-finance.providers';
import {
  settleMatchSchema,
  settlementListSchema,
  settlementMatchIdSchema,
} from './match-settlement.dto';
@Controller('admin/match-settlements')
@UseGuards(MatchFinancePermissionGuard)
export class AdminMatchSettlementController {
  public constructor(
    @Inject(ADMIN_MATCH_SETTLEMENT_SERVICE)
    private readonly service: AdminMatchSettlementService,
    @Inject(MATCH_SETTLEMENT_RECONCILIATION_SERVICE)
    private readonly reconciliation: MatchSettlementReconciliationService,
  ) {}
  @Get()
  @RequireMatchFinancePermission('match_settlements.read')
  public list(@Query(new ZodBodyPipe(settlementListSchema)) query: { limit: number }) {
    return this.service.list(query.limit);
  }
  @Get(':matchId')
  @RequireMatchFinancePermission('match_settlements.read')
  public inspect(@Param('matchId', new ZodBodyPipe(settlementMatchIdSchema)) matchId: string) {
    return this.service.inspect(matchId);
  }
  @Post(':matchId/settle')
  @RateLimit('wallet')
  @RequireMatchFinancePermission('match_settlements.manage')
  public settle(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(settlementMatchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(settleMatchSchema)) body: { idempotencyKey: string },
  ) {
    return this.service.settle(matchId, body.idempotencyKey, actor.userId);
  }
  @Post(':matchId/retry')
  @RateLimit('wallet')
  @RequireMatchFinancePermission('match_settlements.manage')
  public retry(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(settlementMatchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(settleMatchSchema)) body: { idempotencyKey: string },
  ) {
    return this.service.retry(matchId, body.idempotencyKey, actor.userId);
  }
  @Post(':matchId/reconcile')
  @RateLimit('wallet')
  @RequireMatchFinancePermission('match_settlements.reconcile')
  public async reconcile(
    @Param('matchId', new ZodBodyPipe(settlementMatchIdSchema)) matchId: string,
  ) {
    const value = await this.reconciliation.reconcile(matchId);
    return {
      ...value,
      escrowBalance: value.escrowBalance.toString(),
      expectedBalance: value.expectedBalance.toString(),
      difference: value.difference.toString(),
    };
  }
  @Post('recovery/eligible')
  @RateLimit('wallet')
  @RequireMatchFinancePermission('match_settlements.manage')
  public eligible(@Query(new ZodBodyPipe(settlementListSchema)) query: { limit: number }) {
    return this.service.listEligible(new Date(), query.limit);
  }
}
