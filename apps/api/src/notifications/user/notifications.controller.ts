import { Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import type { NotificationService } from '@arena-core/notifications';
import { CurrentPrincipal } from '../../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../../identity/http/identity-http.types';
import { RateLimit } from '../../identity/http/rate-limit.interceptor';
import { notificationIdSchema, notificationListSchema } from '../notifications.dto';
import { NOTIFICATION_SERVICE } from '../notifications.providers';

@Controller('notifications')
export class NotificationsController {
  public constructor(@Inject(NOTIFICATION_SERVICE) private readonly service: NotificationService) {}
  @Get() public list(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Query(new ZodBodyPipe(notificationListSchema))
    query: Parameters<NotificationService['list']>[1],
  ) {
    return this.service.list(p.userId, query);
  }
  @Get('unread-count') public unread(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.service.unreadCount(p.userId);
  }
  @Get(':notificationId') public detail(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('notificationId', new ZodBodyPipe(notificationIdSchema)) id: string,
  ) {
    return this.service.detail(p.userId, id);
  }
  @Post(':notificationId/read') @RateLimit('token') public read(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('notificationId', new ZodBodyPipe(notificationIdSchema)) id: string,
  ) {
    return this.service.markRead(p.userId, id);
  }
  @Post(':notificationId/unread') @RateLimit('token') public markUnread(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('notificationId', new ZodBodyPipe(notificationIdSchema)) id: string,
  ) {
    return this.service.markUnread(p.userId, id);
  }
  @Post(':notificationId/archive') @RateLimit('token') public archive(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('notificationId', new ZodBodyPipe(notificationIdSchema)) id: string,
  ) {
    return this.service.archive(p.userId, id);
  }
}
