import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrincipalRequest } from '../identity/http/identity-http.types';
import { WALLET_AUTHORIZATION, type WalletAuthorization } from './wallet.providers';

const WALLET_PERMISSION = 'wallet.permission';
export type WalletPermission =
  'wallets.read' | 'wallets.issue' | 'wallets.adjust' | 'wallets.reverse' | 'wallets.reconcile';
export const RequireWalletPermission = (permission: WalletPermission) =>
  SetMetadata(WALLET_PERMISSION, permission);
@Injectable()
export class WalletPermissionGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(WALLET_AUTHORIZATION) private readonly authorization: WalletAuthorization,
  ) {}
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<WalletPermission | undefined>(
      WALLET_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    return request.principal
      ? this.authorization.hasPermission(request.principal.userId, permission)
      : false;
  }
}
