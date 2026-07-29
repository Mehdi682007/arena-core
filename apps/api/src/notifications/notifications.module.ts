import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type {
  AdminNotificationService,
  NotificationDeliveryService,
  NotificationOutboxService,
  NotificationPreferenceService,
  NotificationService,
} from '@arena-core/notifications';
import { AdminNotificationsController } from './admin/admin-notifications.controller';
import { NotificationsHttpFilter } from './notifications-http.filter';
import { NotificationsPermissionGuard } from './notifications-permission.guard';
import {
  ADMIN_NOTIFICATION_SERVICE,
  NOTIFICATION_DELIVERY_SERVICE,
  NOTIFICATION_OUTBOX_SERVICE,
  NOTIFICATION_PREFERENCE_SERVICE,
  NOTIFICATION_SERVICE,
  NOTIFICATIONS_AUTHORIZATION,
  PRODUCTION_NOTIFICATION_INTEGRATION,
  notificationsProviders,
  type NotificationsAuthorization,
} from './notifications.providers';
import { NotificationPreferencesController } from './user/notification-preferences.controller';
import { NotificationsController } from './user/notifications.controller';
import { ProductionNotificationIntegration } from './integration/production-notification.integration';
export interface NotificationsModuleOverrides {
  notificationService?: NotificationService;
  preferenceService?: NotificationPreferenceService;
  outboxService?: NotificationOutboxService;
  deliveryService?: NotificationDeliveryService;
  adminService?: AdminNotificationService;
  authorization?: NotificationsAuthorization;
}
@Global()
@Module({})
export class NotificationsModule {
  public static register(overrides: NotificationsModuleOverrides = {}): DynamicModule {
    const values = new Map<symbol, object | undefined>([
      [NOTIFICATION_SERVICE, overrides.notificationService],
      [NOTIFICATION_PREFERENCE_SERVICE, overrides.preferenceService],
      [NOTIFICATION_OUTBOX_SERVICE, overrides.outboxService],
      [NOTIFICATION_DELIVERY_SERVICE, overrides.deliveryService],
      [ADMIN_NOTIFICATION_SERVICE, overrides.adminService],
      [NOTIFICATIONS_AUTHORIZATION, overrides.authorization],
    ]);
    const replaced = new Set([...values].filter(([, v]) => v).map(([k]) => k));
    const providers: Provider[] = notificationsProviders.filter(
      (p) => typeof p === 'function' || !('provide' in p) || !replaced.has(p.provide as symbol),
    );
    for (const [provide, useValue] of values) if (useValue) providers.push({ provide, useValue });
    return {
      module: NotificationsModule,
      controllers: [
        NotificationsController,
        NotificationPreferencesController,
        AdminNotificationsController,
      ],
      providers: [
        ...providers,
        ProductionNotificationIntegration,
        {
          provide: PRODUCTION_NOTIFICATION_INTEGRATION,
          useExisting: ProductionNotificationIntegration,
        },
        NotificationsPermissionGuard,
        { provide: APP_FILTER, useClass: NotificationsHttpFilter },
      ],
      exports: [ADMIN_NOTIFICATION_SERVICE, PRODUCTION_NOTIFICATION_INTEGRATION],
    };
  }
}
