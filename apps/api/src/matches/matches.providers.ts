import { Inject, Injectable, type Provider } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import {
  AdminMatchDisputeService,
  AdminMatchResultService,
  AdminMatchService,
  MatchCreationService,
  MatchDisputeError,
  MatchDisputeService,
  MatchEvidenceService,
  MatchError,
  MatchService,
  MatchResultError,
  MatchResultService,
  MatchStartService,
  PrismaMatchRepository,
  PrismaMatchDisputeRepository,
  PrismaMatchResultRepository,
  PrismaMatchTransactionManager,
  SystemClock,
  type MatchRepository,
  type MatchDisputeRepository,
  type MatchResultRepository,
  type MatchTransactionManager,
  type MatchEntryEligibilityPort,
} from '@arena-core/matches';
import { API_CONFIG } from '../config/config.module';
import { PRODUCTION_NOTIFICATION_INTEGRATION } from '../notifications/notifications.providers';
import type { ProductionNotificationIntegrationPort } from '../notifications/integration/production-notification.integration';
import { DatabaseService } from '../database/database.service';
import { MATCH_ENTRY_ELIGIBILITY } from '../match-finance/match-finance.providers';

export const MATCH_CREATION_SERVICE = Symbol('MATCH_CREATION_SERVICE');
export const MATCH_SERVICE = Symbol('MATCH_SERVICE');
export const ADMIN_MATCH_SERVICE = Symbol('ADMIN_MATCH_SERVICE');
export const MATCH_START_SERVICE = Symbol('MATCH_START_SERVICE');
export const MATCH_RESULT_SERVICE = Symbol('MATCH_RESULT_SERVICE');
export const ADMIN_MATCH_RESULT_SERVICE = Symbol('ADMIN_MATCH_RESULT_SERVICE');
export const MATCH_EVIDENCE_SERVICE = Symbol('MATCH_EVIDENCE_SERVICE');
export const MATCH_DISPUTE_SERVICE = Symbol('MATCH_DISPUTE_SERVICE');
export const ADMIN_MATCH_DISPUTE_SERVICE = Symbol('ADMIN_MATCH_DISPUTE_SERVICE');
export const MATCHES_AUTHORIZATION = Symbol('MATCHES_AUTHORIZATION');
export interface MatchesAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
}
@Injectable()
class ApiMatchRepository {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  public get(): PrismaMatchRepository {
    const client = this.database.getClient();
    if (!client) throw new MatchError('MATCH_SERVICE_UNAVAILABLE');
    return new PrismaMatchRepository(client);
  }
  public transactions(): PrismaMatchTransactionManager {
    const client = this.database.getClient();
    if (!client) throw new MatchError('MATCH_SERVICE_UNAVAILABLE');
    return new PrismaMatchTransactionManager(client);
  }
  public results(): PrismaMatchResultRepository {
    const client = this.database.getClient();
    if (!client) throw new MatchResultError('MATCH_RESULT_SERVICE_UNAVAILABLE');
    return new PrismaMatchResultRepository(client);
  }
  public disputes(): PrismaMatchDisputeRepository {
    const client = this.database.getClient();
    if (!client) throw new MatchDisputeError('MATCH_DISPUTE_SERVICE_UNAVAILABLE');
    return new PrismaMatchDisputeRepository(client);
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
function forward(source: ApiMatchRepository): MatchRepository {
  return new Proxy({} as MatchRepository, {
    get: (_target, property) => {
      if (lifecycle.has(property)) return undefined;
      const repository = source.get();
      const value = Reflect.get(repository, property) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- typed port forwarding. */
      return typeof value === 'function' ? value.bind(repository) : value;
    },
  });
}
function transactions(source: ApiMatchRepository): MatchTransactionManager {
  return { transaction: (operation) => source.transactions().transaction(operation) };
}
function resultRepository(source: ApiMatchRepository): MatchResultRepository {
  return new Proxy({} as MatchResultRepository, {
    get: (_target, property) => {
      if (lifecycle.has(property)) return undefined;
      const repository = source.results();
      const value = Reflect.get(repository, property) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- typed port forwarding. */
      return typeof value === 'function' ? value.bind(repository) : value;
    },
  });
}
function disputeRepository(source: ApiMatchRepository): MatchDisputeRepository {
  return new Proxy({} as MatchDisputeRepository, {
    get: (_target, property) => {
      if (lifecycle.has(property)) return undefined;
      const repository = source.disputes();
      const value = Reflect.get(repository, property) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- typed port forwarding. */
      return typeof value === 'function' ? value.bind(repository) : value;
    },
  });
}
@Injectable()
class DatabaseMatchesAuthorization implements MatchesAuthorization {
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
export const matchesProviders: Provider[] = [
  ApiMatchRepository,
  {
    provide: MATCH_CREATION_SERVICE,
    inject: [ApiMatchRepository, API_CONFIG, PRODUCTION_NOTIFICATION_INTEGRATION],
    useFactory: (
      source: ApiMatchRepository,
      config: ApiServiceConfig,
      integration: ProductionNotificationIntegrationPort,
    ) =>
      new MatchCreationService(
        forward(source),
        transactions(source),
        clock,
        config.matches.readyTtlSeconds,
        integration,
      ),
  },
  {
    provide: MATCH_START_SERVICE,
    inject: [ApiMatchRepository, API_CONFIG, MATCH_ENTRY_ELIGIBILITY],
    useFactory: (
      source: ApiMatchRepository,
      config: ApiServiceConfig,
      entryEligibility: MatchEntryEligibilityPort,
    ) =>
      new MatchStartService(
        resultRepository(source),
        clock,
        config.matches.resultSubmissionTtlSeconds,
        entryEligibility,
      ),
  },
  {
    provide: MATCH_RESULT_SERVICE,
    inject: [ApiMatchRepository, API_CONFIG, PRODUCTION_NOTIFICATION_INTEGRATION],
    useFactory: (
      source: ApiMatchRepository,
      config: ApiServiceConfig,
      integration: ProductionNotificationIntegrationPort,
    ) =>
      new MatchResultService(
        resultRepository(source),
        clock,
        config.matches.resultConflictResolutionTtlSeconds,
        integration,
      ),
  },
  {
    provide: ADMIN_MATCH_RESULT_SERVICE,
    inject: [ApiMatchRepository],
    useFactory: (source: ApiMatchRepository) =>
      new AdminMatchResultService(resultRepository(source), clock),
  },
  {
    provide: MATCH_EVIDENCE_SERVICE,
    inject: [ApiMatchRepository, API_CONFIG],
    useFactory: (source: ApiMatchRepository, config: ApiServiceConfig) =>
      new MatchEvidenceService(
        disputeRepository(source),
        clock,
        config.matches.evidenceSubmissionTtlSeconds,
      ),
  },
  {
    provide: MATCH_DISPUTE_SERVICE,
    inject: [ApiMatchRepository, API_CONFIG, PRODUCTION_NOTIFICATION_INTEGRATION],
    useFactory: (
      source: ApiMatchRepository,
      config: ApiServiceConfig,
      integration: ProductionNotificationIntegrationPort,
    ) =>
      new MatchDisputeService(
        disputeRepository(source),
        clock,
        config.matches.disputeOpenTtlSeconds,
        config.matches.disputeResponseTtlSeconds,
        config.matches.disputeReviewTtlSeconds,
        integration,
      ),
  },
  {
    provide: ADMIN_MATCH_DISPUTE_SERVICE,
    inject: [ApiMatchRepository, PRODUCTION_NOTIFICATION_INTEGRATION],
    useFactory: (source: ApiMatchRepository, integration: ProductionNotificationIntegrationPort) =>
      new AdminMatchDisputeService(disputeRepository(source), clock, integration),
  },
  {
    provide: MATCH_SERVICE,
    inject: [ApiMatchRepository, MATCH_ENTRY_ELIGIBILITY],
    useFactory: (source: ApiMatchRepository, entryEligibility: MatchEntryEligibilityPort) =>
      new MatchService(forward(source), clock, entryEligibility),
  },
  {
    provide: ADMIN_MATCH_SERVICE,
    inject: [ApiMatchRepository],
    useFactory: (source: ApiMatchRepository) => new AdminMatchService(forward(source), clock),
  },
  { provide: MATCHES_AUTHORIZATION, useClass: DatabaseMatchesAuthorization },
];
