import { Inject, Injectable, type Provider } from '@nestjs/common';
import {
  MatchmakingEngine,
  MatchmakingError,
  MatchmakingProposalService,
  MatchmakingRequestService,
  PrismaMatchmakingRepository,
  PrismaMatchmakingTransactionManager,
  SystemClock,
  type MatchmakingRepository,
  type MatchmakingTransactionManager,
} from '@arena-core/matchmaking';
import type { ApiServiceConfig } from '@arena-core/config';
import { DatabaseService } from '../database/database.service';
import { API_CONFIG } from '../config/config.module';
import { PRODUCTION_NOTIFICATION_INTEGRATION } from '../notifications/notifications.providers';
import type { ProductionNotificationIntegrationPort } from '../notifications/integration/production-notification.integration';

export const MATCHMAKING_REQUEST_SERVICE = Symbol('MATCHMAKING_REQUEST_SERVICE');
export const MATCHMAKING_PROPOSAL_SERVICE = Symbol('MATCHMAKING_PROPOSAL_SERVICE');
export const MATCHMAKING_ADMIN_REPOSITORY = Symbol('MATCHMAKING_ADMIN_REPOSITORY');
export const MATCHMAKING_AUTHORIZATION = Symbol('MATCHMAKING_AUTHORIZATION');
export interface MatchmakingAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
}
@Injectable()
class ApiMatchmakingRepository {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  public get(): PrismaMatchmakingRepository {
    const client = this.database.getClient();
    if (!client) throw new MatchmakingError('MATCHMAKING_UNAVAILABLE');
    return new PrismaMatchmakingRepository(client);
  }
  public transactions(): PrismaMatchmakingTransactionManager {
    const client = this.database.getClient();
    if (!client) throw new MatchmakingError('MATCHMAKING_UNAVAILABLE');
    return new PrismaMatchmakingTransactionManager(client);
  }
}
function forward(source: ApiMatchmakingRepository): MatchmakingRepository {
  const nestLifecycleProperties = new Set<PropertyKey>([
    'then',
    'onModuleInit',
    'onApplicationBootstrap',
    'onModuleDestroy',
    'beforeApplicationShutdown',
    'onApplicationShutdown',
  ]);
  return new Proxy({} as MatchmakingRepository, {
    get: (_target, property) => {
      // Nest probes providers for Promise and lifecycle hooks during bootstrap.
      if (nestLifecycleProperties.has(property)) return undefined;
      const repository = source.get();
      const value = Reflect.get(repository, property) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- forwards typed port. */
      return typeof value === 'function' ? value.bind(repository) : value;
    },
  });
}
function forwardTransactions(source: ApiMatchmakingRepository): MatchmakingTransactionManager {
  return {
    transaction: (operation) => source.transactions().transaction(operation),
  };
}
@Injectable()
class DatabaseMatchmakingAuthorization implements MatchmakingAuthorization {
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
const clock = new SystemClock();
export const matchmakingProviders: Provider[] = [
  ApiMatchmakingRepository,
  {
    provide: MATCHMAKING_REQUEST_SERVICE,
    inject: [ApiMatchmakingRepository, API_CONFIG, PRODUCTION_NOTIFICATION_INTEGRATION],
    useFactory: (
      source: ApiMatchmakingRepository,
      config: ApiServiceConfig,
      integration: ProductionNotificationIntegrationPort,
    ) => {
      const repository = forward(source);
      const engine = new MatchmakingEngine(
        repository,
        forwardTransactions(source),
        clock,
        config.matchmaking.maxCandidatesPerEvaluation,
        config.matchmaking.proposalTtlSeconds,
        integration,
      );
      return new MatchmakingRequestService(
        repository,
        engine,
        clock,
        config.matchmaking.requestTtlSeconds,
      );
    },
  },
  {
    provide: MATCHMAKING_PROPOSAL_SERVICE,
    inject: [ApiMatchmakingRepository],
    useFactory: (source: ApiMatchmakingRepository) =>
      new MatchmakingProposalService(forward(source), clock),
  },
  {
    provide: MATCHMAKING_ADMIN_REPOSITORY,
    inject: [ApiMatchmakingRepository],
    useFactory: forward,
  },
  { provide: MATCHMAKING_AUTHORIZATION, useClass: DatabaseMatchmakingAuthorization },
];
