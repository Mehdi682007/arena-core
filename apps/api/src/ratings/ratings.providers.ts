import { Inject, Injectable, type Provider } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import {
  AdminRatingService,
  LeaderboardService,
  PrismaRatingRepository,
  PrismaRatingTransactionManager,
  RatingError,
  RatingReconciliationService,
  RatingService,
  SystemClock,
  UuidGenerator,
} from '@arena-core/rating';
import { API_CONFIG } from '../config/config.module';
import { DatabaseAuthorizationService } from '../authorization/database-authorization.service';
import { DatabaseService } from '../database/database.service';
import { PRODUCTION_NOTIFICATION_INTEGRATION } from '../notifications/notifications.providers';
import type { ProductionNotificationIntegrationPort } from '../notifications/integration/production-notification.integration';

export const RATING_SERVICE = Symbol('RATING_SERVICE');
export const LEADERBOARD_SERVICE = Symbol('LEADERBOARD_SERVICE');
export const ADMIN_RATING_SERVICE = Symbol('ADMIN_RATING_SERVICE');
export const RATING_RECONCILIATION_SERVICE = Symbol('RATING_RECONCILIATION_SERVICE');
export const RATINGS_AUTHORIZATION = Symbol('RATINGS_AUTHORIZATION');

export interface RatingsAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
}

@Injectable()
class RatingsRuntime {
  public constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PRODUCTION_NOTIFICATION_INTEGRATION)
    private readonly integration: ProductionNotificationIntegrationPort,
  ) {}
  public create(config: ApiServiceConfig) {
    const client = this.database.getClient();
    if (!client) throw new RatingError('RATING_SERVICE_UNAVAILABLE');
    const repository = new PrismaRatingRepository(client);
    const transactions = new PrismaRatingTransactionManager(client);
    const rating = new RatingService(
      repository,
      transactions,
      new SystemClock(),
      new UuidGenerator(),
      {
        key: 'ELO',
        version: 1,
        initialRating: config.rating.initialValue,
        provisionalMatchCount: config.rating.provisionalMatchCount,
        provisionalKFactor: config.rating.provisionalKFactor,
        establishedKFactor: config.rating.establishedKFactor,
        minimumRating: config.rating.minimumValue,
        maximumRating: config.rating.maximumValue,
      },
      config.rating.matchDelaySeconds,
      this.integration,
    );
    return { repository, rating };
  }
}

const lifecycle = new Set<PropertyKey>([
  'then',
  'onModuleInit',
  'onApplicationBootstrap',
  'onModuleDestroy',
  'beforeApplicationShutdown',
  'onApplicationShutdown',
]);
function serviceProxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get: (_target, property) => {
      if (lifecycle.has(property)) return undefined;
      const service = factory();
      const value = Reflect.get(service, property) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- typed port forwarding. */
      return typeof value === 'function' ? value.bind(service) : value;
    },
  });
}

export const ratingsProviders: Provider[] = [
  RatingsRuntime,
  { provide: RATINGS_AUTHORIZATION, useExisting: DatabaseAuthorizationService },
  {
    provide: RATING_SERVICE,
    inject: [RatingsRuntime, API_CONFIG],
    useFactory: (runtime: RatingsRuntime, config: ApiServiceConfig) =>
      serviceProxy(() => runtime.create(config).rating),
  },
  {
    provide: LEADERBOARD_SERVICE,
    inject: [RatingsRuntime, API_CONFIG],
    useFactory: (runtime: RatingsRuntime, config: ApiServiceConfig) =>
      serviceProxy(
        () =>
          new LeaderboardService(
            runtime.create(config).repository,
            config.rating.leaderboardMinimumMatchesPlayed,
          ),
      ),
  },
  {
    provide: ADMIN_RATING_SERVICE,
    inject: [RatingsRuntime, API_CONFIG],
    useFactory: (runtime: RatingsRuntime, config: ApiServiceConfig) =>
      serviceProxy(() => {
        const value = runtime.create(config);
        return new AdminRatingService(value.rating, value.repository);
      }),
  },
  {
    provide: RATING_RECONCILIATION_SERVICE,
    inject: [RatingsRuntime, API_CONFIG],
    useFactory: (runtime: RatingsRuntime, config: ApiServiceConfig) =>
      serviceProxy(() => new RatingReconciliationService(runtime.create(config).repository)),
  },
];
