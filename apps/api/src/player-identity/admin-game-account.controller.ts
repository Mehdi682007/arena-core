import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AdminGameAccountQuery,
  AdminGameAccountVerificationService,
  GameAccountReviewAction,
} from '@arena-core/player-identity';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  accountIdSchema,
  adminGameAccountQuerySchema,
  rejectSchema,
  requestChangesSchema,
  suspendSchema,
  versionActionSchema,
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
  public list(@Query(new ZodBodyPipe(adminGameAccountQuerySchema)) query: AdminGameAccountQuery) {
    return this.service.listPendingGameAccounts(query);
  }
  @Get(':accountId')
  public get(@Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string) {
    return this.service.getGameAccount(accountId);
  }
  @Get(':accountId/reviews')
  @RequirePlayerIdentityPermission('game_accounts.audit.read')
  public reviews(@Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string) {
    return this.service.getGameAccountReviewHistory(accountId);
  }
  @Post(':accountId/verify')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.verify')
  public verify(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(versionActionSchema)) body: { expectedVersion: number },
  ) {
    return this.action(actor, accountId, 'VERIFY', body);
  }
  @Post(':accountId/reject')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.reject')
  public reject(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(rejectSchema))
    body: { reasonCode: string; note?: string; userMessage?: string; expectedVersion: number },
  ) {
    return this.action(actor, accountId, 'REJECT', body);
  }
  @Post(':accountId/request-changes')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.reject')
  public requestChanges(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(requestChangesSchema))
    body: { reasonCode: string; note?: string; userMessage?: string; expectedVersion: number },
  ) {
    return this.action(actor, accountId, 'REQUEST_CHANGES', body);
  }
  @Post(':accountId/suspend')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.suspend')
  public suspend(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(suspendSchema))
    body: { reasonCode: string; note?: string; userMessage?: string; expectedVersion: number },
  ) {
    return this.action(actor, accountId, 'SUSPEND', body);
  }
  @Post(':accountId/restore')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.restore')
  public restore(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(versionActionSchema)) body: { expectedVersion: number },
  ) {
    return this.action(actor, accountId, 'RESTORE', body);
  }
  @Post(':accountId/disconnect')
  @RateLimit('game-account')
  @RequirePlayerIdentityPermission('game_accounts.suspend')
  public disconnect(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(versionActionSchema)) body: { expectedVersion: number },
  ) {
    return this.action(actor, accountId, 'DISCONNECT', body);
  }
  private action(
    actor: AuthenticatedPrincipal,
    accountId: string,
    action: GameAccountReviewAction,
    detail: { reasonCode?: string; note?: string; userMessage?: string; expectedVersion: number },
  ) {
    return this.service.review({ actorUserId: actor.userId, accountId, action, ...detail });
  }
}
