import type {
  AttachPlatformInput,
  CatalogRecord,
  CreateGameInput,
  CreateGameModeInput,
  CreateCrossplayGroupInput,
  CreatePlatformInput,
  CreateRulesetInput,
  PublicGame,
  PublicGameSummary,
  PublicRuleset,
  RulesetConfig,
  RulesetRecord,
  SetCrossplayPlatformsInput,
  UpdateGameInput,
} from '../domain/catalog-types';

export interface GameCatalogRepository {
  listPublicGames(): Promise<readonly PublicGameSummary[]>;
  findPublicGameBySlug(slug: string): Promise<PublicGame | null>;
  findDefaultPublicRuleset(slug: string, modeKey?: string): Promise<PublicRuleset | null>;
  createGame(input: CreateGameInput): Promise<CatalogRecord>;
  findGameById(id: string): Promise<CatalogRecord | null>;
  updateGame(input: UpdateGameInput): Promise<CatalogRecord>;
  createPlatform(input: CreatePlatformInput): Promise<CatalogRecord>;
  attachPlatform(input: AttachPlatformInput): Promise<CatalogRecord>;
  createMode(input: CreateGameModeInput): Promise<CatalogRecord>;
  createCrossplayGroup(input: CreateCrossplayGroupInput): Promise<CatalogRecord>;
  setCrossplayPlatforms(input: SetCrossplayPlatformsInput): Promise<CatalogRecord>;
  createRuleset(input: CreateRulesetInput): Promise<RulesetRecord>;
  findLatestRulesetVersion(gameId: string, key: string): Promise<number | null>;
  findRulesetById(id: string): Promise<RulesetRecord | null>;
  updateRulesetDraft(id: string, name: string, config: RulesetConfig): Promise<RulesetRecord>;
  publishRuleset(id: string): Promise<RulesetRecord>;
  transitionRuleset(id: string, status: 'SUPERSEDED' | 'ARCHIVED'): Promise<RulesetRecord>;
  setDefaultRuleset(id: string): Promise<RulesetRecord>;
}

export interface GameCatalogTransactionManager {
  transaction<T>(operation: (repository: GameCatalogRepository) => Promise<T>): Promise<T>;
}
