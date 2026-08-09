import { Inject, Injectable, type Provider } from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import type { EmailSender } from '@arena-core/email';
import {
  AdminNotificationService,
  EmailPackageNotificationAdapter,
  NotificationDeliveryService,
  NotificationError,
  NotificationOutboxService,
  NotificationPreferenceService,
  NotificationService,
  PrismaNotificationRepository,
  PrismaNotificationTransactionManager,
  SystemClock,
  UuidGenerator,
} from '@arena-core/notifications';
import { API_CONFIG } from '../config/config.module';
import { DatabaseAuthorizationService } from '../authorization/database-authorization.service';
import { DatabaseService } from '../database/database.service';
import { EMAIL_SENDER } from '../email/email.tokens';

export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');
export const NOTIFICATION_PREFERENCE_SERVICE = Symbol('NOTIFICATION_PREFERENCE_SERVICE');
export const NOTIFICATION_OUTBOX_SERVICE = Symbol('NOTIFICATION_OUTBOX_SERVICE');
export const NOTIFICATION_DELIVERY_SERVICE = Symbol('NOTIFICATION_DELIVERY_SERVICE');
export const ADMIN_NOTIFICATION_SERVICE = Symbol('ADMIN_NOTIFICATION_SERVICE');
export const NOTIFICATIONS_AUTHORIZATION = Symbol('NOTIFICATIONS_AUTHORIZATION');
export const PRODUCTION_NOTIFICATION_INTEGRATION = Symbol('PRODUCTION_NOTIFICATION_INTEGRATION');
export interface NotificationsAuthorization {
  hasPermission(userId: string, permission: string): Promise<boolean>;
}

@Injectable()
class NotificationsRuntime {
  public constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EMAIL_SENDER) private readonly sender: EmailSender,
  ) {}
  public create(config: ApiServiceConfig) {
    const client = this.database.getClient();
    if (!client) throw new NotificationError('NOTIFICATION_SERVICE_UNAVAILABLE');
    const repository = new PrismaNotificationRepository(client);
    const transactions = new PrismaNotificationTransactionManager(client);
    const clock = new SystemClock();
    const ids = new UuidGenerator();
    const notification = new NotificationService(repository, transactions, clock, ids);
    const preferences = new NotificationPreferenceService(repository, clock, ids);
    const policy = {
      maxAttempts: config.notifications.deliveryMaxAttempts,
      retryBaseSeconds: config.notifications.retryBaseSeconds,
      retryMaxSeconds: config.notifications.retryMaxSeconds,
      claimLeaseSeconds: config.notifications.claimLeaseSeconds,
    };
    const email = new EmailPackageNotificationAdapter(
      client,
      this.sender,
      config.email.from,
      config.email.replyTo,
    );
    return {
      notification,
      preferences,
      outbox: new NotificationOutboxService(repository, clock, ids, policy),
      delivery: new NotificationDeliveryService(repository, email, clock, ids, policy),
      admin: new AdminNotificationService(repository, clock),
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
    get: (_t, p) => {
      if (lifecycle.has(p)) return undefined;
      const s = factory();
      const v = Reflect.get(s, p) as unknown;
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-return -- typed service proxy forwarding. */
      return typeof v === 'function' ? v.bind(s) : v;
    },
  });
}
const service = (
  token: symbol,
  pick: (r: ReturnType<NotificationsRuntime['create']>) => object,
): Provider => ({
  provide: token,
  inject: [NotificationsRuntime, API_CONFIG],
  useFactory: (runtime: NotificationsRuntime, config: ApiServiceConfig) =>
    proxy(() => pick(runtime.create(config))),
});
export const notificationsProviders: Provider[] = [
  NotificationsRuntime,
  { provide: NOTIFICATIONS_AUTHORIZATION, useExisting: DatabaseAuthorizationService },
  service(NOTIFICATION_SERVICE, (r) => r.notification),
  service(NOTIFICATION_PREFERENCE_SERVICE, (r) => r.preferences),
  service(NOTIFICATION_OUTBOX_SERVICE, (r) => r.outbox),
  service(NOTIFICATION_DELIVERY_SERVICE, (r) => r.delivery),
  service(ADMIN_NOTIFICATION_SERVICE, (r) => r.admin),
];
