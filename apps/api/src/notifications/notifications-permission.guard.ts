import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrincipalRequest } from '../identity/http/identity-http.types';
import {
  NOTIFICATIONS_AUTHORIZATION,
  type NotificationsAuthorization,
} from './notifications.providers';
const KEY = 'notifications.permission';
export type NotificationPermission =
  'notifications.read' | 'notifications.manage' | 'notifications.retry';
export const RequireNotificationPermission = (permission: NotificationPermission) =>
  SetMetadata(KEY, permission);
@Injectable()
export class NotificationsPermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(NOTIFICATIONS_AUTHORIZATION) private readonly authorization: NotificationsAuthorization,
  ) {}
  public canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<NotificationPermission | undefined>(KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const principal = context.switchToHttp().getRequest<PrincipalRequest>().principal;
    return principal ? this.authorization.hasPermission(principal.userId, permission) : false;
  }
}
