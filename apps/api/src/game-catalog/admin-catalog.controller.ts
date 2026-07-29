import { Body, Controller, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AdminGameCatalogService, GameRulesetService } from '@arena-core/game-catalog';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import {
  attachPlatformSchema,
  catalogIdSchema,
  createCrossplayGroupSchema,
  createGameSchema,
  createModeSchema,
  createPlatformSchema,
  createRulesetSchema,
  setCrossplayPlatformsSchema,
  updateGameSchema,
  updateRulesetSchema,
} from './catalog.dto';
import { CatalogPermissionGuard, RequireCatalogPermission } from './catalog-permission.guard';
import { ADMIN_CATALOG_SERVICE, RULESET_SERVICE } from './catalog.providers';

@Controller('admin/catalog')
@UseGuards(CatalogPermissionGuard)
@RequireCatalogPermission('games.manage')
export class AdminCatalogController {
  public constructor(
    @Inject(ADMIN_CATALOG_SERVICE) private readonly catalog: AdminGameCatalogService,
    @Inject(RULESET_SERVICE) private readonly rulesets: GameRulesetService,
  ) {}
  @Post('games')
  public createGame(
    @Body(new ZodBodyPipe(createGameSchema))
    body: Parameters<AdminGameCatalogService['createGame']>[0],
  ) {
    return this.catalog.createGame(body);
  }
  @Patch('games/:id')
  public updateGame(
    @Param('id', new ZodBodyPipe(catalogIdSchema)) id: string,
    @Body(new ZodBodyPipe(updateGameSchema))
    body: Omit<Parameters<AdminGameCatalogService['updateGame']>[0], 'id'>,
  ) {
    return this.catalog.updateGame({ id, ...body });
  }
  @Post('platforms')
  @RequireCatalogPermission('platforms.manage')
  public createPlatform(
    @Body(new ZodBodyPipe(createPlatformSchema))
    body: Parameters<AdminGameCatalogService['createPlatform']>[0],
  ) {
    return this.catalog.createPlatform(body);
  }
  @Post('games/:gameId/platforms')
  @RequireCatalogPermission('platforms.manage')
  public attachPlatform(
    @Param('gameId', new ZodBodyPipe(catalogIdSchema)) gameId: string,
    @Body(new ZodBodyPipe(attachPlatformSchema))
    body: Omit<Parameters<AdminGameCatalogService['attachPlatform']>[0], 'gameId'>,
  ) {
    return this.catalog.attachPlatform({ gameId, ...body });
  }
  @Post('games/:gameId/modes')
  public createMode(
    @Param('gameId', new ZodBodyPipe(catalogIdSchema)) gameId: string,
    @Body(new ZodBodyPipe(createModeSchema))
    body: Omit<Parameters<AdminGameCatalogService['createMode']>[0], 'gameId'>,
  ) {
    return this.catalog.createMode({ gameId, ...body });
  }
  @Post('games/:gameId/crossplay-groups')
  public createCrossplayGroup(
    @Param('gameId', new ZodBodyPipe(catalogIdSchema)) gameId: string,
    @Body(new ZodBodyPipe(createCrossplayGroupSchema))
    body: Omit<Parameters<AdminGameCatalogService['createCrossplayGroup']>[0], 'gameId'>,
  ) {
    return this.catalog.createCrossplayGroup({ gameId, ...body });
  }
  @Patch('games/:gameId/crossplay-groups/:id/platforms')
  public setCrossplayPlatforms(
    @Param('gameId', new ZodBodyPipe(catalogIdSchema)) gameId: string,
    @Param('id', new ZodBodyPipe(catalogIdSchema)) crossplayGroupId: string,
    @Body(new ZodBodyPipe(setCrossplayPlatformsSchema))
    body: { gamePlatformIds: readonly string[] },
  ) {
    return this.catalog.setCrossplayPlatforms({ gameId, crossplayGroupId, ...body });
  }
  @Post('rulesets')
  @RequireCatalogPermission('rulesets.manage')
  public createRuleset(
    @Body(new ZodBodyPipe(createRulesetSchema))
    body: Parameters<GameRulesetService['createDraft']>[0],
  ) {
    return this.rulesets.createDraft(body);
  }
  @Patch('rulesets/:id')
  @RequireCatalogPermission('rulesets.manage')
  public updateRuleset(
    @Param('id', new ZodBodyPipe(catalogIdSchema)) id: string,
    @Body(new ZodBodyPipe(updateRulesetSchema))
    body: { name: string; configuration: Parameters<GameRulesetService['updateDraft']>[2] },
  ) {
    return this.rulesets.updateDraft(id, body.name, body.configuration);
  }
  @Post('rulesets/:id/publish')
  @RequireCatalogPermission('rulesets.manage')
  public publish(@Param('id', new ZodBodyPipe(catalogIdSchema)) id: string) {
    return this.rulesets.publish(id);
  }
  @Post('rulesets/:id/default')
  @RequireCatalogPermission('rulesets.manage')
  public setDefault(@Param('id', new ZodBodyPipe(catalogIdSchema)) id: string) {
    return this.rulesets.setDefault(id);
  }
  @Post('rulesets/:id/supersede')
  @RequireCatalogPermission('rulesets.manage')
  public supersede(@Param('id', new ZodBodyPipe(catalogIdSchema)) id: string) {
    return this.rulesets.transition(id, 'SUPERSEDED');
  }
  @Post('rulesets/:id/archive')
  @RequireCatalogPermission('rulesets.manage')
  public archive(@Param('id', new ZodBodyPipe(catalogIdSchema)) id: string) {
    return this.rulesets.transition(id, 'ARCHIVED');
  }
}
