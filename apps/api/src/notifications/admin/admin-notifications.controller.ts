import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminNotificationService } from '@arena-core/notifications';
import { ZodBodyPipe } from '../../identity/http/dto/identity.dto';
import { RateLimit } from '../../identity/http/rate-limit.interceptor';
import {
  adminOutboxSchema,
  notificationIdSchema,
  recoverySchema,
  sourceRecoverySchema,
} from '../notifications.dto';
import type { ProductionNotificationIntegrationPort } from '../integration/production-notification.integration';
import {
  NotificationsPermissionGuard,
  RequireNotificationPermission,
} from '../notifications-permission.guard';
import {
  ADMIN_NOTIFICATION_SERVICE,
  PRODUCTION_NOTIFICATION_INTEGRATION,
} from '../notifications.providers';
@Controller('admin/notifications')
@UseGuards(NotificationsPermissionGuard)
export class AdminNotificationsController {
  public constructor(
    @Inject(ADMIN_NOTIFICATION_SERVICE) private readonly service: AdminNotificationService,
    @Inject(PRODUCTION_NOTIFICATION_INTEGRATION)
    private readonly integration: ProductionNotificationIntegrationPort,
  ) {}
  @Get('outbox') @RequireNotificationPermission('notifications.read') public list(
    @Query(new ZodBodyPipe(adminOutboxSchema))
    query: Parameters<AdminNotificationService['list']>[0],
  ) {
    return this.service.list(query).then((page) => ({
      ...page,
      items: page.items.map((item) => this.view(item)),
    }));
  }
  @Get('outbox/dead-letter') @RequireNotificationPermission('notifications.read') public dead(
    @Query('limit') limit = '50',
  ) {
    return this.service
      .deadLetter(Math.min(Number(limit) || 50, 100))
      .then((page) => ({ ...page, items: page.items.map((item) => this.view(item)) }));
  }
  @Get('outbox/:outboxMessageId')
  @RequireNotificationPermission('notifications.read')
  public detail(@Param('outboxMessageId', new ZodBodyPipe(notificationIdSchema)) id: string) {
    return this.service.detail(id).then((item) => this.view(item));
  }
  @Post('outbox/:outboxMessageId/retry')
  @RateLimit('token')
  @RequireNotificationPermission('notifications.retry')
  public retry(@Param('outboxMessageId', new ZodBodyPipe(notificationIdSchema)) id: string) {
    return this.service.retry(id).then((item) => this.view(item));
  }
  @Post('recovery/claims')
  @RateLimit('token')
  @RequireNotificationPermission('notifications.manage')
  public recover(@Body(new ZodBodyPipe(recoverySchema)) body: { limit: number }) {
    return this.service.releaseClaims(body.limit);
  }
  @Post('recovery/sources')
  @RateLimit('token')
  @RequireNotificationPermission('notifications.manage')
  public recoverSource(
    @Body(new ZodBodyPipe(sourceRecoverySchema))
    body: {
      sourceType: string;
      sourceId: string;
    },
  ) {
    return this.integration
      .recoverMissingNotificationsForSource(body.sourceType, body.sourceId)
      .then((recovered) => ({ recovered }));
  }
  private view(item: Awaited<ReturnType<AdminNotificationService['detail']>>) {
    return {
      id: item.id,
      notificationId: item.notificationId,
      type: item.notification.type,
      channel: item.channel,
      status: item.status,
      availableAt: item.availableAt,
      attemptCount: item.attemptCount,
      lastAttemptAt: item.lastAttemptAt,
      deliveredAt: item.deliveredAt,
      failedAt: item.failedAt,
      deadLetteredAt: item.deadLetteredAt,
      lastErrorCode: item.lastErrorCode,
      version: item.version,
    };
  }
}
