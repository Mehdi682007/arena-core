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
import {
  PLAYER_IDENTITY_AUTHORIZATION,
  type PlayerIdentityAuthorization,
} from './player-identity.providers';

const KEY = 'player-identity.permission';
export type PlayerIdentityPermission =
  | 'game_accounts.read'
  | 'game_accounts.review'
  | 'game_accounts.verify'
  | 'game_accounts.reject'
  | 'game_accounts.suspend'
  | 'game_accounts.restore'
  | 'game_accounts.audit.read';
export const RequirePlayerIdentityPermission = (permission: PlayerIdentityPermission) =>
  SetMetadata(KEY, permission);
@Injectable()
export class PlayerIdentityPermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(PLAYER_IDENTITY_AUTHORIZATION)
    private readonly authorization: PlayerIdentityAuthorization,
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
