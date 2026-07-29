import { Inject, Injectable, type Provider } from '@nestjs/common';
import {
  AdminMatchFinanceService,
  AdminMatchSettlementService,
  MatchEntryReservationService,
  MatchEscrowService,
  MatchFinanceError,
  PrismaMatchFinanceRepository,
  PrismaMatchFinanceTransactionManager,
  PrismaMatchSettlementLedgerAdapter,
  PrismaMatchSettlementRepository,
  PrismaWalletLedgerAdapter,
  SystemClock,
  UuidGenerator,
  MatchSettlementService,
  MatchSettlementReconciliationService,
  MatchSettlementError,
} from '@arena-core/match-finance';
import type { MatchEntryEligibilityPort } from '@arena-core/matches';
import type { ApiServiceConfig } from '@arena-core/config';
import { API_CONFIG } from '../config/config.module';
import { PRODUCTION_NOTIFICATION_INTEGRATION } from '../notifications/notifications.providers';
import type { ProductionNotificationIntegrationPort } from '../notifications/integration/production-notification.integration';
import { DatabaseService } from '../database/database.service';

export const MATCH_ENTRY_RESERVATION_SERVICE = Symbol('MATCH_ENTRY_RESERVATION_SERVICE');
export const ADMIN_MATCH_FINANCE_SERVICE = Symbol('ADMIN_MATCH_FINANCE_SERVICE');
export const MATCH_ENTRY_ELIGIBILITY = Symbol('MATCH_ENTRY_ELIGIBILITY');
export const MATCH_FINANCE_AUTHORIZATION = Symbol('MATCH_FINANCE_AUTHORIZATION');
export const MATCH_SETTLEMENT_SERVICE = Symbol('MATCH_SETTLEMENT_SERVICE');
export const ADMIN_MATCH_SETTLEMENT_SERVICE = Symbol('ADMIN_MATCH_SETTLEMENT_SERVICE');
export const MATCH_SETTLEMENT_RECONCILIATION_SERVICE = Symbol(
  'MATCH_SETTLEMENT_RECONCILIATION_SERVICE',
);

export interface MatchFinanceAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
}

@Injectable()
class MatchFinanceRuntime {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  public create() {
    const client = this.database.getClient();
    if (!client) throw new MatchFinanceError('MATCH_FINANCE_SERVICE_UNAVAILABLE');
    const transactions = new PrismaMatchFinanceTransactionManager(client);
    const repository = new PrismaMatchFinanceRepository(transactions);
    const ledger = new PrismaWalletLedgerAdapter(transactions);
    return { transactions, repository, ledger };
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

@Injectable()
class DatabaseMatchFinanceAuthorization implements MatchFinanceAuthorization {
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
const ids = new UuidGenerator();
function settlementRuntime(runtime: MatchFinanceRuntime) {
  try {
    return runtime.create();
  } catch {
    throw new MatchSettlementError('MATCH_SETTLEMENT_SERVICE_UNAVAILABLE');
  }
}
export const matchFinanceProviders: Provider[] = [
  MatchFinanceRuntime,
  {
    provide: MATCH_ENTRY_RESERVATION_SERVICE,
    inject: [MatchFinanceRuntime, API_CONFIG],
    useFactory: (runtime: MatchFinanceRuntime, config: ApiServiceConfig) =>
      serviceProxy(() => {
        const value = runtime.create();
        return new MatchEntryReservationService(
          value.repository,
          value.ledger,
          value.transactions,
          clock,
          ids,
          config.matches.entryReservationTtlSeconds,
        );
      }),
  },
  {
    provide: ADMIN_MATCH_FINANCE_SERVICE,
    inject: [MatchFinanceRuntime],
    useFactory: (runtime: MatchFinanceRuntime) =>
      serviceProxy(() => {
        const value = runtime.create();
        return new AdminMatchFinanceService(
          value.repository,
          value.ledger,
          value.transactions,
          clock,
        );
      }),
  },
  {
    provide: MATCH_ENTRY_ELIGIBILITY,
    inject: [MatchFinanceRuntime],
    useFactory: (runtime: MatchFinanceRuntime): MatchEntryEligibilityPort =>
      serviceProxy(() => {
        const value = runtime.create();
        const service = new MatchEscrowService(value.repository, clock);
        return {
          assertParticipantEntrySatisfied: (matchId: string, participantId: string) =>
            service.assertParticipantEntrySatisfied(matchId, participantId),
          assertMatchEntrySatisfied: (matchId: string) =>
            service.assertMatchEntrySatisfied(matchId),
          releaseMatchEntries: (matchId: string) => service.releaseMatch(matchId),
        };
      }),
  },
  { provide: MATCH_FINANCE_AUTHORIZATION, useClass: DatabaseMatchFinanceAuthorization },
  {
    provide: MATCH_SETTLEMENT_SERVICE,
    inject: [MatchFinanceRuntime, API_CONFIG, PRODUCTION_NOTIFICATION_INTEGRATION],
    useFactory: (
      runtime: MatchFinanceRuntime,
      config: ApiServiceConfig,
      integration: ProductionNotificationIntegrationPort,
    ) =>
      serviceProxy(() => {
        const value = settlementRuntime(runtime);
        const repository = new PrismaMatchSettlementRepository(value.transactions);
        const ledger = new PrismaMatchSettlementLedgerAdapter(value.transactions);
        return new MatchSettlementService(
          repository,
          ledger,
          value.transactions,
          clock,
          ids,
          config.matches.settlementDelaySeconds,
          integration,
        );
      }),
  },
  {
    provide: ADMIN_MATCH_SETTLEMENT_SERVICE,
    inject: [MatchFinanceRuntime, API_CONFIG, PRODUCTION_NOTIFICATION_INTEGRATION],
    useFactory: (
      runtime: MatchFinanceRuntime,
      config: ApiServiceConfig,
      integration: ProductionNotificationIntegrationPort,
    ) =>
      serviceProxy(() => {
        const value = settlementRuntime(runtime);
        const repository = new PrismaMatchSettlementRepository(value.transactions);
        const ledger = new PrismaMatchSettlementLedgerAdapter(value.transactions);
        const service = new MatchSettlementService(
          repository,
          ledger,
          value.transactions,
          clock,
          ids,
          config.matches.settlementDelaySeconds,
          integration,
        );
        return new AdminMatchSettlementService(
          service,
          repository,
          config.matches.settlementDelaySeconds,
        );
      }),
  },
  {
    provide: MATCH_SETTLEMENT_RECONCILIATION_SERVICE,
    inject: [MatchFinanceRuntime],
    useFactory: (runtime: MatchFinanceRuntime) =>
      serviceProxy(() => {
        const value = settlementRuntime(runtime);
        return new MatchSettlementReconciliationService(
          new PrismaMatchSettlementRepository(value.transactions),
          new PrismaMatchSettlementLedgerAdapter(value.transactions),
        );
      }),
  },
];
