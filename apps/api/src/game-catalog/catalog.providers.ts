import { Inject, Injectable, type Provider } from '@nestjs/common';
import {
  AdminGameCatalogService,
  CatalogError,
  GameRulesetService,
  PrismaGameCatalogRepository,
  PrismaGameCatalogTransactionManager,
  PublicGameCatalogService,
  type GameCatalogRepository,
  type GameCatalogTransactionManager,
} from '@arena-core/game-catalog';
import { DatabaseAuthorizationService } from '../authorization/database-authorization.service';
import { DatabaseService } from '../database/database.service';

export const PUBLIC_CATALOG_SERVICE = Symbol('PUBLIC_CATALOG_SERVICE');
export const ADMIN_CATALOG_SERVICE = Symbol('ADMIN_CATALOG_SERVICE');
export const RULESET_SERVICE = Symbol('RULESET_SERVICE');
export const CATALOG_AUTHORIZATION = Symbol('CATALOG_AUTHORIZATION');

export interface CatalogAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
}

@Injectable()
class ApiCatalogRepository implements GameCatalogRepository {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  private repository(): PrismaGameCatalogRepository {
    const client = this.database.getClient();
    if (client === undefined) throw new CatalogError('GAME_CATALOG_UNAVAILABLE');
    return new PrismaGameCatalogRepository(client);
  }
  public listPublicGames() {
    return this.repository().listPublicGames();
  }
  public findPublicGameBySlug(slug: string) {
    return this.repository().findPublicGameBySlug(slug);
  }
  public findDefaultPublicRuleset(slug: string) {
    return this.repository().findDefaultPublicRuleset(slug);
  }
  public createGame(input: Parameters<GameCatalogRepository['createGame']>[0]) {
    return this.repository().createGame(input);
  }
  public findGameById(id: string) {
    return this.repository().findGameById(id);
  }
  public updateGame(input: Parameters<GameCatalogRepository['updateGame']>[0]) {
    return this.repository().updateGame(input);
  }
  public createPlatform(input: Parameters<GameCatalogRepository['createPlatform']>[0]) {
    return this.repository().createPlatform(input);
  }
  public attachPlatform(input: Parameters<GameCatalogRepository['attachPlatform']>[0]) {
    return this.repository().attachPlatform(input);
  }
  public createMode(input: Parameters<GameCatalogRepository['createMode']>[0]) {
    return this.repository().createMode(input);
  }
  public createCrossplayGroup(input: Parameters<GameCatalogRepository['createCrossplayGroup']>[0]) {
    return this.repository().createCrossplayGroup(input);
  }
  public setCrossplayPlatforms(
    input: Parameters<GameCatalogRepository['setCrossplayPlatforms']>[0],
  ) {
    return this.repository().setCrossplayPlatforms(input);
  }
  public createRuleset(input: Parameters<GameCatalogRepository['createRuleset']>[0]) {
    return this.repository().createRuleset(input);
  }
  public findLatestRulesetVersion(gameId: string, key: string) {
    return this.repository().findLatestRulesetVersion(gameId, key);
  }
  public findRulesetById(id: string) {
    return this.repository().findRulesetById(id);
  }
  public updateRulesetDraft(
    id: string,
    name: string,
    config: Parameters<GameCatalogRepository['updateRulesetDraft']>[2],
  ) {
    return this.repository().updateRulesetDraft(id, name, config);
  }
  public publishRuleset(id: string) {
    return this.repository().publishRuleset(id);
  }
  public transitionRuleset(id: string, status: 'SUPERSEDED' | 'ARCHIVED') {
    return this.repository().transitionRuleset(id, status);
  }
  public setDefaultRuleset(id: string) {
    return this.repository().setDefaultRuleset(id);
  }
}

@Injectable()
class ApiCatalogTransactions implements GameCatalogTransactionManager {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  public transaction<T>(operation: (repository: GameCatalogRepository) => Promise<T>): Promise<T> {
    const client = this.database.getClient();
    if (client === undefined) throw new CatalogError('GAME_CATALOG_UNAVAILABLE');
    return new PrismaGameCatalogTransactionManager(client).transaction(operation);
  }
}

export const catalogProviders: Provider[] = [
  ApiCatalogRepository,
  ApiCatalogTransactions,
  {
    provide: PUBLIC_CATALOG_SERVICE,
    inject: [ApiCatalogRepository],
    useFactory: (repository: ApiCatalogRepository) => new PublicGameCatalogService(repository),
  },
  {
    provide: ADMIN_CATALOG_SERVICE,
    inject: [ApiCatalogRepository],
    useFactory: (repository: ApiCatalogRepository) => new AdminGameCatalogService(repository),
  },
  {
    provide: RULESET_SERVICE,
    inject: [ApiCatalogRepository, ApiCatalogTransactions],
    useFactory: (repository: ApiCatalogRepository, transactions: ApiCatalogTransactions) =>
      new GameRulesetService(repository, transactions),
  },
  { provide: CATALOG_AUTHORIZATION, useExisting: DatabaseAuthorizationService },
];
