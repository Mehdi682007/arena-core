import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrincipalRequest } from '../identity/http/identity-http.types';
import {
  MATCH_FINANCE_AUTHORIZATION,
  type MatchFinanceAuthorization,
} from './match-finance.providers';

const PERMISSION = 'match-finance.permission';
export type MatchFinancePermission =
  | 'match_finance.read'
  | 'match_finance.manage'
  | 'match_finance.reconcile'
  | 'match_settlements.read'
  | 'match_settlements.manage'
  | 'match_settlements.reconcile';
export const RequireMatchFinancePermission = (permission: MatchFinancePermission) =>
  SetMetadata(PERMISSION, permission);

@Injectable()
export class MatchFinancePermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(MATCH_FINANCE_AUTHORIZATION)
    private readonly authorization: MatchFinanceAuthorization,
  ) {}
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<MatchFinancePermission | undefined>(
      PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;
    const principal = context.switchToHttp().getRequest<PrincipalRequest>().principal;
    return principal ? this.authorization.hasPermission(principal.userId, permission) : false;
  }
}
