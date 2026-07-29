import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrincipalRequest } from '../identity/http/identity-http.types';
import { CATALOG_AUTHORIZATION, type CatalogAuthorization } from './catalog.providers';

const CATALOG_PERMISSION = 'catalog.permission';
export type CatalogPermission =
  'games.read' | 'games.manage' | 'platforms.manage' | 'rulesets.manage';
export const RequireCatalogPermission = (permission: CatalogPermission) =>
  SetMetadata(CATALOG_PERMISSION, permission);

@Injectable()
export class CatalogPermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(CATALOG_AUTHORIZATION) private readonly authorization: CatalogAuthorization,
  ) {}
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<unknown>(CATALOG_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (typeof permission !== 'string') return false;
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    if (
      request.principal === undefined ||
      !(await this.authorization.hasPermission(request.principal.userId, permission))
    )
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Permission is required.' });
    return true;
  }
}
