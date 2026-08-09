import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type Provider } from '@nestjs/common';
import {
  AdminOperationError,
  AdminSearchService,
  AdminTimelineService,
  AuditQueryService,
  PrismaAdminOperationRepository,
  SupportOperationService,
  type NotificationSupportPort,
} from '@arena-core/admin-operations';
import type { AdminNotificationService } from '@arena-core/notifications';
import { DatabaseAuthorizationService } from '../authorization/database-authorization.service';
import { DatabaseService } from '../database/database.service';
import {
  ADMIN_NOTIFICATION_SERVICE,
  PRODUCTION_NOTIFICATION_INTEGRATION,
} from '../notifications/notifications.providers';
import type { ProductionNotificationIntegrationPort } from '../notifications/integration/production-notification.integration';
export const AUDIT_QUERY_SERVICE = Symbol('AUDIT_QUERY_SERVICE');
export const ADMIN_SEARCH_SERVICE = Symbol('ADMIN_SEARCH_SERVICE');
export const ADMIN_TIMELINE_SERVICE = Symbol('ADMIN_TIMELINE_SERVICE');
export const SUPPORT_OPERATION_SERVICE = Symbol('SUPPORT_OPERATION_SERVICE');
export const ADMIN_OPERATIONS_AUTHORIZATION = Symbol('ADMIN_OPERATIONS_AUTHORIZATION');
export interface AdminOperationsAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
  listPermissions?(userId: string): Promise<readonly string[]>;
}
@Injectable()
class Runtime {
  public constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  public create() {
    const client = this.database.getClient();
    if (!client) throw new AdminOperationError('ADMIN_OPERATIONS_UNAVAILABLE');
    const repository = new PrismaAdminOperationRepository(client);
    const audit = new AuditQueryService(repository);
    return {
      audit,
      search: new AdminSearchService(repository),
      timeline: new AdminTimelineService(repository),
    };
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
function proxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get: (_target, property) => {
      if (lifecycle.has(property)) return undefined;
      const service = factory();
      const value = Reflect.get(service, property) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- typed service proxy forwarding. */
      return typeof value === 'function' ? value.bind(service) : value;
    },
  });
}
const service = (
  token: symbol,
  pick: (runtime: ReturnType<Runtime['create']>) => object,
): Provider => ({
  provide: token,
  inject: [Runtime],
  useFactory: (runtime: Runtime) => proxy(() => pick(runtime.create())),
});
export const adminOperationsProviders: Provider[] = [
  Runtime,
  { provide: ADMIN_OPERATIONS_AUTHORIZATION, useExisting: DatabaseAuthorizationService },
  service(AUDIT_QUERY_SERVICE, (runtime) => runtime.audit),
  service(ADMIN_SEARCH_SERVICE, (runtime) => runtime.search),
  service(ADMIN_TIMELINE_SERVICE, (runtime) => runtime.timeline),
  {
    provide: SUPPORT_OPERATION_SERVICE,
    inject: [Runtime, ADMIN_NOTIFICATION_SERVICE, PRODUCTION_NOTIFICATION_INTEGRATION],
    useFactory: (
      runtime: Runtime,
      notifications: AdminNotificationService,
      integration: ProductionNotificationIntegrationPort,
    ) => {
      const port: NotificationSupportPort = {
        retry: (id) => notifications.retry(id),
        recover: (sourceType, sourceId) =>
          integration.recoverMissingNotificationsForSource(sourceType, sourceId),
      };
      return proxy(
        () =>
          new SupportOperationService(
            port,
            runtime.create().audit,
            { generate: randomUUID },
            { now: () => new Date() },
          ),
      );
    },
  },
];
