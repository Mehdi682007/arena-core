import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrincipalRequest } from '../identity/http/identity-http.types';
import { MATCHES_AUTHORIZATION, type MatchesAuthorization } from './matches.providers';

const MATCH_PERMISSION = 'match.permission';
export const RequireMatchPermission = (
  permission:
    | 'matches.read'
    | 'matches.manage'
    | 'match_results.read'
    | 'match_results.resolve'
    | 'match_disputes.read'
    | 'match_disputes.assign'
    | 'match_disputes.review',
) => SetMetadata(MATCH_PERMISSION, permission);
@Injectable()
export class MatchesPermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(MATCHES_AUTHORIZATION) private readonly authorization: MatchesAuthorization,
  ) {}
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(MATCH_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    return request.principal
      ? this.authorization.hasPermission(request.principal.userId, permission)
      : false;
  }
}
