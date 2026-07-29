import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminRatingService, RatingReconciliationService } from '@arena-core/rating';
import { CurrentPrincipal } from '../../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../../identity/http/identity-http.types';
import { RateLimit } from '../../identity/http/rate-limit.interceptor';
import {
  applyRatingSchema,
  ratingIdSchema,
  ratingListSchema,
  recoverySchema,
} from '../ratings.dto';
import { ADMIN_RATING_SERVICE, RATING_RECONCILIATION_SERVICE } from '../ratings.providers';
import { RatingsPermissionGuard, RequireRatingPermission } from '../ratings-permission.guard';

@Controller('admin/ratings')
@UseGuards(RatingsPermissionGuard)
export class AdminRatingsController {
  public constructor(
    @Inject(ADMIN_RATING_SERVICE) private readonly admin: AdminRatingService,
    @Inject(RATING_RECONCILIATION_SERVICE)
    private readonly reconciliation: RatingReconciliationService,
  ) {}

  @Get()
  @RequireRatingPermission('ratings.read')
  public list(@Query(new ZodBodyPipe(ratingListSchema)) query: { limit: number }) {
    return this.admin.list(query.limit);
  }

  @Get('users/:userId')
  @RequireRatingPermission('ratings.read')
  public user(@Param('userId', new ZodBodyPipe(ratingIdSchema)) userId: string) {
    return this.admin.listUser(userId);
  }

  @Get('matches/:matchId')
  @RequireRatingPermission('ratings.read')
  public match(@Param('matchId', new ZodBodyPipe(ratingIdSchema)) matchId: string) {
    return this.admin.match(matchId);
  }

  @Post('matches/:matchId/apply')
  @RateLimit('matches')
  @RequireRatingPermission('ratings.manage')
  public apply(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(ratingIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(applyRatingSchema)) body: { idempotencyKey: string },
  ) {
    return this.admin.apply(matchId, body.idempotencyKey, principal.userId);
  }

  @Post('matches/:matchId/retry')
  @RateLimit('matches')
  @RequireRatingPermission('ratings.manage')
  public retry(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(ratingIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(applyRatingSchema)) body: { idempotencyKey: string },
  ) {
    return this.admin.apply(matchId, body.idempotencyKey, principal.userId);
  }

  @Post('users/:userId/reconcile')
  @RateLimit('matches')
  @RequireRatingPermission('ratings.reconcile')
  public reconcile(@Param('userId', new ZodBodyPipe(ratingIdSchema)) userId: string) {
    return this.reconciliation.reconcileUser(userId);
  }

  @Post('recovery/eligible')
  @RateLimit('matches')
  @RequireRatingPermission('ratings.manage')
  public recover(@Body(new ZodBodyPipe(recoverySchema)) body: { limit: number }) {
    return this.admin.recoverEligible(new Date(), body.limit);
  }
}
