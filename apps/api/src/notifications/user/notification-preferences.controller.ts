import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import type { NotificationPreferenceService } from '@arena-core/notifications';
import { CurrentPrincipal } from '../../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../../identity/http/identity-http.types';
import { RateLimit } from '../../identity/http/rate-limit.interceptor';
import { notificationTypeSchema, preferenceSchema } from '../notifications.dto';
import { NOTIFICATION_PREFERENCE_SERVICE } from '../notifications.providers';
@Controller('notification-preferences')
export class NotificationPreferencesController {
  public constructor(
    @Inject(NOTIFICATION_PREFERENCE_SERVICE)
    private readonly service: NotificationPreferenceService,
  ) {}
  @Get() public list(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.service.list(p.userId);
  }
  @Put(':type') @RateLimit('token') public update(
    @CurrentPrincipal() p: AuthenticatedPrincipal,
    @Param('type', new ZodBodyPipe(notificationTypeSchema)) type: string,
    @Body(new ZodBodyPipe(preferenceSchema))
    body: { inAppEnabled: boolean; emailEnabled: boolean; expectedVersion?: number },
  ) {
    return this.service.update(p.userId, type, body);
  }
}
