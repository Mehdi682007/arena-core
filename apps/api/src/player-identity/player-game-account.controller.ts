import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import type { PlayerGameAccountService } from '@arena-core/player-identity';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  accountIdSchema,
  createClaimSchema,
  emptyActionSchema,
  resubmitSchema,
} from './player-identity.dto';
import { PLAYER_GAME_ACCOUNT_SERVICE } from './player-identity.providers';

@Controller('game-accounts')
export class PlayerGameAccountController {
  public constructor(
    @Inject(PLAYER_GAME_ACCOUNT_SERVICE) private readonly service: PlayerGameAccountService,
  ) {}
  @Get()
  public list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.service.listMyGameAccounts(principal.userId);
  }
  @Post()
  @RateLimit('game-account')
  public async create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body(new ZodBodyPipe(createClaimSchema))
    body: { gameId: string; gamePlatformId: string; handle: string },
  ) {
    return this.service.createGameAccountClaim({ userId: principal.userId, ...body });
  }
  @Get(':accountId')
  public get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
  ) {
    return this.service.getMyGameAccount(principal.userId, accountId);
  }
  @Post(':accountId/disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  public disconnect(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(emptyActionSchema)) _body: Record<string, never>,
  ) {
    void _body;
    return this.service.disconnectMyGameAccount(principal.userId, accountId);
  }
  @Post(':accountId/primary')
  @HttpCode(HttpStatus.NO_CONTENT)
  public primary(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(emptyActionSchema)) _body: Record<string, never>,
  ) {
    void _body;
    return this.service.setPrimaryGameAccount(principal.userId, accountId);
  }
  @Post(':accountId/resubmit')
  @RateLimit('game-account')
  public resubmit(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('accountId', new ZodBodyPipe(accountIdSchema)) accountId: string,
    @Body(new ZodBodyPipe(resubmitSchema)) _body: Record<string, never>,
  ) {
    void _body;
    return this.service.resubmitRejectedGameAccount(principal.userId, accountId);
  }
}
