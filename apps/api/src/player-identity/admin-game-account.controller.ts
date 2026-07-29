import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AdminGameAccountVerificationService,
  GameAccountReviewAction,
  GameAccountStatus,
} from '@arena-core/player-identity';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  accountIdSchema,
  adminFilterSchema,
  emptyActionSchema,
  rejectSchema,
  suspendSchema,
} from './player-identity.dto';
import {
  PlayerIdentityPermissionGuard,
  RequirePlayerIdentityPermission,
} from './player-identity-permission.guard';
import { ADMIN_GAME_ACCOUNT_SERVICE } from './player-identity.providers';

@Controller('admin/game-accounts')
@UseGuards(PlayerIdentityPermissionGuard)
@RequirePlayerIdentityPermission('game_accounts.read')
export class AdminGameAccountController {
  public constructor(
    @Inject(ADMIN_GAME_ACCOUNT_SERVICE)
    private readonly service: AdminGameAccountVerificationService,
  ) {}
  @Get()
  public list(
    @Query('status', new ZodBodyPipe(adminFilterSchema.optional())) status?: GameAccountStatus,
  ) {
    return this.service.listPendingGameAccounts(status);
  }
  @Get(':accountId')
  public get(@Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string) {
    return this.service.getGameAccount(accountId);
  }
  @Get(':accountId/reviews')
  public reviews(@Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string) {
    return this.service.getGameAccountReviewHistory(accountId);
  }
  @Post(':accountId/verify')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.verify')
  public verify(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(emptyActionSchema)) _body: Record<string, never>,
  ) {
    void _body;
    return this.action(actor, accountId, 'VERIFY');
  }
  @Post(':accountId/reject')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.verify')
  public reject(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(rejectSchema)) body: { reasonCode: string; note?: string },
  ) {
    return this.action(actor, accountId, 'REJECT', body);
  }
  @Post(':accountId/suspend')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.suspend')
  public suspend(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(suspendSchema)) body: { reasonCode: string; note?: string },
  ) {
    return this.action(actor, accountId, 'SUSPEND', body);
  }
  @Post(':accountId/restore')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.suspend')
  public restore(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(emptyActionSchema)) _body: Record<string, never>,
  ) {
    void _body;
    return this.action(actor, accountId, 'RESTORE');
  }
  @Post(':accountId/disconnect')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.suspend')
  public disconnect(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(emptyActionSchema)) _body: Record<string, never>,
  ) {
    void _body;
    return this.action(actor, accountId, 'DISCONNECT');
  }
  private action(
    actor: AuthenticatedPrincipal,
    accountId: string,
    action: GameAccountReviewAction,
    detail: { reasonCode?: string; note?: string } = {},
  ) {
    return this.service.review({ actorUserId: actor.userId, accountId, action, ...detail });
  }
}
