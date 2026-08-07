import { Inject, Injectable, type Provider } from '@nestjs/common';
import {
  AdminGameAccountVerificationService,
  GameAccountCatalogService,
  PlayerGameAccountService,
  PlayerIdentityError,
  PrismaGameAccountCatalogRepository,
  PrismaPlayerGameAccountRepository,
  type GameAccountCatalogRepository,
  type PlayerGameAccountRepository,
} from '@arena-core/player-identity';
import { DatabaseService } from '../database/database.service';

export const PLAYER_GAME_ACCOUNT_SERVICE = Symbol('PLAYER_GAME_ACCOUNT_SERVICE');
export const GAME_ACCOUNT_CATALOG_SERVICE = Symbol('GAME_ACCOUNT_CATALOG_SERVICE');
export const ADMIN_GAME_ACCOUNT_SERVICE = Symbol('ADMIN_GAME_ACCOUNT_SERVICE');
export const PLAYER_IDENTITY_AUTHORIZATION = Symbol('PLAYER_IDENTITY_AUTHORIZATION');
export interface PlayerIdentityAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
}
@Injectable()
class ApiPlayerGameAccountRepository {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  public get(): PlayerGameAccountRepository {
    const client = this.database.getClient();
    if (!client) throw new PlayerIdentityError('PLAYER_IDENTITY_UNAVAILABLE');
    return new PrismaPlayerGameAccountRepository(client);
  }
}
@Injectable()
class ApiGameAccountCatalogRepository implements GameAccountCatalogRepository {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  public listClaimableGamePlatforms() {
    const client = this.database.getClient();
    if (!client) throw new PlayerIdentityError('PLAYER_IDENTITY_UNAVAILABLE');
    return new PrismaGameAccountCatalogRepository(client).listClaimableGamePlatforms();
  }
}
@Injectable()
class DatabasePlayerIdentityAuthorization implements PlayerIdentityAuthorization {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  public async hasPermission(userId: string, permission: string): Promise<boolean> {
    const client = this.database.getClient();
    if (!client) return false;
    return (
      (await client.userRole.findFirst({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          role: { permissions: { some: { permission: { key: permission } } } },
        },
        select: { userId: true },
      })) !== null
    );
  }
}
function forwardingRepository(source: ApiPlayerGameAccountRepository): PlayerGameAccountRepository {
  return new Proxy({} as PlayerGameAccountRepository, {
    get: (_target, property) => {
      const repository = source.get();
      const value = Reflect.get(repository, property) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Proxy forwards the typed port. */
      return typeof value === 'function' ? value.bind(repository) : value;
    },
  });
}
export const playerIdentityProviders: Provider[] = [
  ApiPlayerGameAccountRepository,
  ApiGameAccountCatalogRepository,
  {
    provide: PLAYER_GAME_ACCOUNT_SERVICE,
    inject: [ApiPlayerGameAccountRepository],
    useFactory: (repository: ApiPlayerGameAccountRepository) =>
      new PlayerGameAccountService(forwardingRepository(repository)),
  },
  {
    provide: GAME_ACCOUNT_CATALOG_SERVICE,
    inject: [ApiGameAccountCatalogRepository],
    useFactory: (repository: ApiGameAccountCatalogRepository) =>
      new GameAccountCatalogService(repository),
  },
  {
    provide: ADMIN_GAME_ACCOUNT_SERVICE,
    inject: [ApiPlayerGameAccountRepository],
    useFactory: (repository: ApiPlayerGameAccountRepository) =>
      new AdminGameAccountVerificationService(forwardingRepository(repository)),
  },
  { provide: PLAYER_IDENTITY_AUTHORIZATION, useClass: DatabasePlayerIdentityAuthorization },
];
