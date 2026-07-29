import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminMatchFinanceService } from '@arena-core/match-finance';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  matchFinanceListSchema,
  matchFinanceMatchIdSchema,
  refundMatchEntrySchema,
  recoveryRefundSchema,
  releaseRecoverySchema,
} from './match-finance.dto';
import {
  MatchFinancePermissionGuard,
  RequireMatchFinancePermission,
} from './match-finance-permission.guard';
import { ADMIN_MATCH_FINANCE_SERVICE } from './match-finance.providers';

@Controller('admin/match-finance')
@UseGuards(MatchFinancePermissionGuard)
export class AdminMatchFinanceController {
  public constructor(
    @Inject(ADMIN_MATCH_FINANCE_SERVICE) private readonly service: AdminMatchFinanceService,
  ) {}
  @Get('matches/:matchId/reservations')
  @RequireMatchFinancePermission('match_finance.read')
  public list(
    @Param('matchId', new ZodBodyPipe(matchFinanceMatchIdSchema)) matchId: string,
    @Query(new ZodBodyPipe(matchFinanceListSchema)) query: { limit: number },
  ) {
    return this.service.listMatch(matchId, query.limit);
  }
  @Post('matches/:matchId/refund')
  @RateLimit('wallet')
  @RequireMatchFinancePermission('match_finance.manage')
  public refund(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchFinanceMatchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(refundMatchEntrySchema))
    body: {
      reasonCode:
        | 'MATCH_CANCELLED'
        | 'MATCH_EXPIRED'
        | 'MATCH_VOIDED_BEFORE_START'
        | 'OPERATIONAL_RECOVERY'
        | 'OTHER';
      idempotencyKey: string;
      note?: string;
      limit?: number;
    },
  ) {
    return this.service.refund({ ...body, matchId, actorUserId: actor.userId });
  }
  @Post('matches/:matchId/reconcile')
  @RateLimit('wallet')
  @RequireMatchFinancePermission('match_finance.reconcile')
  public reconcile(@Param('matchId', new ZodBodyPipe(matchFinanceMatchIdSchema)) matchId: string) {
    return this.service.reconcile(matchId).then((result) => ({
      consistent: result.consistent,
      escrowBalance: result.escrowBalance.toString(),
      expectedBalance: result.expectedBalance.toString(),
      difference: result.difference.toString(),
      reservationCount: result.reservationCount,
    }));
  }
  @Post('recovery/release')
  @RateLimit('wallet')
  @RequireMatchFinancePermission('match_finance.manage')
  public release(@Body(new ZodBodyPipe(releaseRecoverySchema)) body: { matchId: string }) {
    return this.service.release(body.matchId);
  }
  @Post('recovery/refund')
  @RateLimit('wallet')
  @RequireMatchFinancePermission('match_finance.manage')
  public recoveryRefund(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Body(new ZodBodyPipe(recoveryRefundSchema))
    body: {
      matchId: string;
      reasonCode:
        | 'MATCH_CANCELLED'
        | 'MATCH_EXPIRED'
        | 'MATCH_VOIDED_BEFORE_START'
        | 'OPERATIONAL_RECOVERY'
        | 'OTHER';
      idempotencyKey: string;
      note?: string;
      limit?: number;
    },
  ) {
    return this.service.refund({ ...body, actorUserId: actor.userId });
  }
}
