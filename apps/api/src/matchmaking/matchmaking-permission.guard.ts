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
import { MATCHMAKING_AUTHORIZATION, type MatchmakingAuthorization } from './matchmaking.providers';

const KEY = 'matchmaking.permission';
export const RequireMatchmakingPermission = (permission: 'matchmaking.read') =>
  SetMetadata(KEY, permission);
@Injectable()
export class MatchmakingPermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(MATCHMAKING_AUTHORIZATION) private readonly authorization: MatchmakingAuthorization,
  ) {}
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<unknown>(KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    if (
      typeof permission !== 'string' ||
      !request.principal ||
      !(await this.authorization.hasPermission(request.principal.userId, permission))
    )
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Permission is required.' });
    return true;
  }
}
