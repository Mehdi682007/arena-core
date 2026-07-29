import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type {
  AdminGameCatalogService,
  GameRulesetService,
  PublicGameCatalogService,
} from '@arena-core/game-catalog';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogPermissionGuard } from './catalog-permission.guard';
import {
  ADMIN_CATALOG_SERVICE,
  CATALOG_AUTHORIZATION,
  type CatalogAuthorization,
  catalogProviders,
  PUBLIC_CATALOG_SERVICE,
  RULESET_SERVICE,
} from './catalog.providers';
import { PublicCatalogController } from './public-catalog.controller';

export interface GameCatalogModuleOverrides {
  readonly publicService?: PublicGameCatalogService;
  readonly adminService?: AdminGameCatalogService;
  readonly rulesetService?: GameRulesetService;
  readonly authorization?: CatalogAuthorization;
}
@Module({})
export class GameCatalogModule {
  public static register(overrides: GameCatalogModuleOverrides = {}): DynamicModule {
    const replacements = new Set<symbol>();
    if (overrides.publicService) replacements.add(PUBLIC_CATALOG_SERVICE);
    if (overrides.adminService) replacements.add(ADMIN_CATALOG_SERVICE);
    if (overrides.rulesetService) replacements.add(RULESET_SERVICE);
    if (overrides.authorization) replacements.add(CATALOG_AUTHORIZATION);
    const providers: Provider[] = catalogProviders.filter(
      (provider) =>
        typeof provider === 'function' ||
        !('provide' in provider) ||
        !replacements.has(provider.provide as symbol),
    );
    if (overrides.publicService)
      providers.push({ provide: PUBLIC_CATALOG_SERVICE, useValue: overrides.publicService });
    if (overrides.adminService)
      providers.push({ provide: ADMIN_CATALOG_SERVICE, useValue: overrides.adminService });
    if (overrides.rulesetService)
      providers.push({ provide: RULESET_SERVICE, useValue: overrides.rulesetService });
    if (overrides.authorization)
      providers.push({ provide: CATALOG_AUTHORIZATION, useValue: overrides.authorization });
    return {
      module: GameCatalogModule,
      controllers: [PublicCatalogController, AdminCatalogController],
      providers: [...providers, CatalogPermissionGuard],
    };
  }
}
