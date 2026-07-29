import { CatalogError } from '../domain/catalog-errors';
import {
  assertCatalogKey,
  assertGameSlug,
  assertGameStatusTransition,
  assertModeCapacity,
  assertName,
  assertRulesetConfig,
  assertRulesetStatusTransition,
  assertSortOrder,
} from '../domain/catalog-policies';
import type {
  AttachPlatformInput,
  CatalogRecord,
  CreateGameInput,
  CreateGameModeInput,
  CreatePlatformInput,
  CreateCrossplayGroupInput,
  CreateRulesetInput,
  PublicGame,
  PublicGameSummary,
  PublicRuleset,
  RulesetConfig,
  SetCrossplayPlatformsInput,
  RulesetRecord,
  UpdateGameInput,
} from '../domain/catalog-types';
import type {
  GameCatalogRepository,
  GameCatalogTransactionManager,
} from '../ports/game-catalog-repository';

export class PublicGameCatalogService {
  public constructor(private readonly repository: GameCatalogRepository) {}
  public listGames(): Promise<readonly PublicGameSummary[]> {
    return this.repository.listPublicGames();
  }
  public async getGame(slug: string): Promise<PublicGame> {
    assertGameSlug(slug);
    const game = await this.repository.findPublicGameBySlug(slug);
    if (game === null) throw new CatalogError('CATALOG_NOT_FOUND');
    return game;
  }
  public async getDefaultRuleset(slug: string, modeKey?: string): Promise<PublicRuleset> {
    assertGameSlug(slug);
    if (modeKey !== undefined) assertCatalogKey(modeKey);
    const ruleset = await this.repository.findDefaultPublicRuleset(slug, modeKey);
    if (ruleset === null) throw new CatalogError('CATALOG_NOT_FOUND');
    return ruleset;
  }
}

export class AdminGameCatalogService {
  public constructor(private readonly repository: GameCatalogRepository) {}
  public createGame(input: CreateGameInput): Promise<CatalogRecord> {
    assertCatalogKey(input.key);
    assertGameSlug(input.slug);
    assertName(input.name);
    if (input.shortName !== undefined && input.shortName !== null) assertName(input.shortName, 60);
    assertSortOrder(input.sortOrder ?? 0);
    return this.repository.createGame(input);
  }
  public async updateGame(input: UpdateGameInput): Promise<CatalogRecord> {
    if (input.name !== undefined) assertName(input.name);
    if (input.shortName !== undefined) assertName(input.shortName, 60);
    if (input.sortOrder !== undefined) assertSortOrder(input.sortOrder);
    const current = await this.repository.findGameById(input.id);
    if (current === null) throw new CatalogError('CATALOG_NOT_FOUND');
    if (input.status !== undefined)
      assertGameStatusTransition(
        current.status as Parameters<typeof assertGameStatusTransition>[0],
        input.status,
      );
    return this.repository.updateGame(input);
  }
  public createPlatform(input: CreatePlatformInput): Promise<CatalogRecord> {
    assertCatalogKey(input.key);
    assertGameSlug(input.slug);
    assertName(input.name, 100);
    assertSortOrder(input.sortOrder ?? 0);
    return this.repository.createPlatform(input);
  }
  public attachPlatform(input: AttachPlatformInput): Promise<CatalogRecord> {
    assertSortOrder(input.sortOrder ?? 0);
    return this.repository.attachPlatform(input);
  }
  public createMode(input: CreateGameModeInput): Promise<CatalogRecord> {
    assertCatalogKey(input.key);
    assertGameSlug(input.slug);
    assertName(input.name, 100);
    assertSortOrder(input.sortOrder ?? 0);
    assertModeCapacity(
      input.teamSizeMin,
      input.teamSizeMax,
      input.participantCountMin,
      input.participantCountMax,
    );
    return this.repository.createMode(input);
  }
  public createCrossplayGroup(input: CreateCrossplayGroupInput): Promise<CatalogRecord> {
    assertCatalogKey(input.key);
    assertName(input.name, 100);
    assertSortOrder(input.sortOrder ?? 0);
    return this.repository.createCrossplayGroup(input);
  }
  public setCrossplayPlatforms(input: SetCrossplayPlatformsInput): Promise<CatalogRecord> {
    if (new Set(input.gamePlatformIds).size !== input.gamePlatformIds.length)
      throw new CatalogError('INVALID_CATALOG_VALUE');
    return this.repository.setCrossplayPlatforms(input);
  }
}

export class GameRulesetService {
  public constructor(
    private readonly repository: GameCatalogRepository,
    private readonly transactions: GameCatalogTransactionManager,
  ) {}
  public async createDraft(input: CreateRulesetInput): Promise<RulesetRecord> {
    assertCatalogKey(input.key);
    assertName(input.name);
    if (!Number.isSafeInteger(input.version) || input.version < 1)
      throw new CatalogError('INVALID_CATALOG_VALUE');
    assertRulesetConfig(input.configuration);
    const latest = await this.repository.findLatestRulesetVersion(input.gameId, input.key);
    if (input.version !== (latest ?? 0) + 1) throw new CatalogError('CATALOG_CONFLICT');
    return this.repository.createRuleset(input);
  }
  public async updateDraft(
    id: string,
    name: string,
    config: RulesetConfig,
  ): Promise<RulesetRecord> {
    assertName(name);
    assertRulesetConfig(config);
    const existing = await this.repository.findRulesetById(id);
    if (existing === null) throw new CatalogError('CATALOG_NOT_FOUND');
    if (existing.status !== 'DRAFT') throw new CatalogError('RULESET_IMMUTABLE');
    return this.repository.updateRulesetDraft(id, name, config);
  }
  public publish(id: string): Promise<RulesetRecord> {
    return this.transactions.transaction(async (repository) => {
      const existing = await repository.findRulesetById(id);
      if (existing === null) throw new CatalogError('CATALOG_NOT_FOUND');
      if (existing.status !== 'DRAFT') throw new CatalogError('RULESET_IMMUTABLE');
      return repository.publishRuleset(id);
    });
  }
  public setDefault(id: string): Promise<RulesetRecord> {
    return this.transactions.transaction(async (repository) => {
      const existing = await repository.findRulesetById(id);
      if (existing === null) throw new CatalogError('CATALOG_NOT_FOUND');
      if (existing.status !== 'ACTIVE') throw new CatalogError('INVALID_STATUS_TRANSITION');
      return repository.setDefaultRuleset(id);
    });
  }
  public transition(id: string, status: 'SUPERSEDED' | 'ARCHIVED'): Promise<RulesetRecord> {
    return this.transactions.transaction(async (repository) => {
      const existing = await repository.findRulesetById(id);
      if (existing === null) throw new CatalogError('CATALOG_NOT_FOUND');
      assertRulesetStatusTransition(
        existing.status as Parameters<typeof assertRulesetStatusTransition>[0],
        status,
      );
      return repository.transitionRuleset(id, status);
    });
  }
}
