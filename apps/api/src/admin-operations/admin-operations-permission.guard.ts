import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrincipalRequest } from '../identity/http/identity-http.types';
import {
  ADMIN_OPERATIONS_AUTHORIZATION,
  type AdminOperationsAuthorization,
} from './admin-operations.providers';
const KEY = 'admin-operations.permission';
const CAPABILITIES_KEY = 'admin-operations.capabilities';
export type AdminOperationsPermission =
  | 'users.read'
  | 'users.manage_status'
  | 'users.manage_sessions'
  | 'users.verify_email'
  | 'roles.read'
  | 'roles.assign'
  | 'roles.manage'
  | 'audit.read'
  | 'support.read'
  | 'support.manage'
  | 'timeline.read'
  | 'diagnostics.read';
export const RequireAdminOperationsPermission = (permission: AdminOperationsPermission) =>
  SetMetadata(KEY, permission);
export const AllowAdminCapabilities = () => SetMetadata(CAPABILITIES_KEY, true);
@Injectable()
export class AdminOperationsPermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(ADMIN_OPERATIONS_AUTHORIZATION)
    private readonly authorization: AdminOperationsAuthorization,
  ) {}
  public canActivate(context: ExecutionContext) {
    const capabilities = this.reflector.getAllAndOverride<boolean | undefined>(CAPABILITIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const principal = context.switchToHttp().getRequest<PrincipalRequest>().principal;
    if (capabilities) return Boolean(principal);
    const permission = this.reflector.getAllAndOverride<AdminOperationsPermission | undefined>(
      KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return false;
    return principal ? this.authorization.hasPermission(principal.userId, permission) : false;
  }
}
