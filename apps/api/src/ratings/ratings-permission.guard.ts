import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrincipalRequest } from '../identity/http/identity-http.types';
import { RATINGS_AUTHORIZATION, type RatingsAuthorization } from './ratings.providers';

const PERMISSION = 'ratings.permission';
export type RatingPermission = 'ratings.read' | 'ratings.manage' | 'ratings.reconcile';
export const RequireRatingPermission = (permission: RatingPermission) =>
  SetMetadata(PERMISSION, permission);

@Injectable()
export class RatingsPermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(RATINGS_AUTHORIZATION) private readonly authorization: RatingsAuthorization,
  ) {}
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<RatingPermission | undefined>(PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const principal = context.switchToHttp().getRequest<PrincipalRequest>().principal;
    return principal ? this.authorization.hasPermission(principal.userId, permission) : false;
  }
}
