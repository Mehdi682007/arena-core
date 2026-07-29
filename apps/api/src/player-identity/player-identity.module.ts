import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type {
  AdminGameAccountVerificationService,
  PlayerGameAccountService,
} from '@arena-core/player-identity';
import { AdminGameAccountController } from './admin-game-account.controller';
import { PlayerGameAccountController } from './player-game-account.controller';
import { PlayerIdentityHttpFilter } from './player-identity-http.filter';
import { PlayerIdentityPermissionGuard } from './player-identity-permission.guard';
import {
  ADMIN_GAME_ACCOUNT_SERVICE,
  PLAYER_GAME_ACCOUNT_SERVICE,
  PLAYER_IDENTITY_AUTHORIZATION,
  type PlayerIdentityAuthorization,
  playerIdentityProviders,
} from './player-identity.providers';

export interface PlayerIdentityModuleOverrides {
  readonly playerService?: PlayerGameAccountService;
  readonly adminService?: AdminGameAccountVerificationService;
  readonly authorization?: PlayerIdentityAuthorization;
}
@Module({})
export class PlayerIdentityModule {
  public static register(overrides: PlayerIdentityModuleOverrides = {}): DynamicModule {
    const replacements = new Set<symbol>();
    if (overrides.playerService) replacements.add(PLAYER_GAME_ACCOUNT_SERVICE);
    if (overrides.adminService) replacements.add(ADMIN_GAME_ACCOUNT_SERVICE);
    if (overrides.authorization) replacements.add(PLAYER_IDENTITY_AUTHORIZATION);
    const providers: Provider[] = playerIdentityProviders.filter(
      (provider) =>
        typeof provider === 'function' ||
        !('provide' in provider) ||
        !replacements.has(provider.provide as symbol),
    );
    if (overrides.playerService)
      providers.push({ provide: PLAYER_GAME_ACCOUNT_SERVICE, useValue: overrides.playerService });
    if (overrides.adminService)
      providers.push({ provide: ADMIN_GAME_ACCOUNT_SERVICE, useValue: overrides.adminService });
    if (overrides.authorization)
      providers.push({ provide: PLAYER_IDENTITY_AUTHORIZATION, useValue: overrides.authorization });
    return {
      module: PlayerIdentityModule,
      controllers: [PlayerGameAccountController, AdminGameAccountController],
      providers: [
        ...providers,
        PlayerIdentityPermissionGuard,
        { provide: APP_FILTER, useClass: PlayerIdentityHttpFilter },
      ],
    };
  }
}
