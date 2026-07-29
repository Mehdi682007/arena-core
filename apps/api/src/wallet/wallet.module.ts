import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type {
  AdminWalletService,
  WalletQueryService,
  WalletReconciliationService,
} from '@arena-core/wallet';
import { AdminWalletController } from './admin-wallet.controller';
import { UserWalletController } from './user-wallet.controller';
import { WalletHttpFilter } from './wallet-http.filter';
import { WalletPermissionGuard } from './wallet-permission.guard';
import {
  ADMIN_WALLET_SERVICE,
  WALLET_AUTHORIZATION,
  WALLET_QUERY_SERVICE,
  WALLET_RECONCILIATION_SERVICE,
  walletProviders,
  type WalletAuthorization,
} from './wallet.providers';
export interface WalletModuleOverrides {
  queryService?: WalletQueryService;
  adminService?: AdminWalletService;
  reconciliationService?: WalletReconciliationService;
  authorization?: WalletAuthorization;
}
@Global()
@Module({})
export class WalletModule {
  public static register(overrides: WalletModuleOverrides = {}): DynamicModule {
    const replacements = new Set<symbol>();
    if (overrides.queryService) replacements.add(WALLET_QUERY_SERVICE);
    if (overrides.adminService) replacements.add(ADMIN_WALLET_SERVICE);
    if (overrides.reconciliationService) replacements.add(WALLET_RECONCILIATION_SERVICE);
    if (overrides.authorization) replacements.add(WALLET_AUTHORIZATION);
    const providers: Provider[] = walletProviders.filter(
      (provider) =>
        typeof provider === 'function' ||
        !('provide' in provider) ||
        !replacements.has(provider.provide as symbol),
    );
    if (overrides.queryService)
      providers.push({ provide: WALLET_QUERY_SERVICE, useValue: overrides.queryService });
    if (overrides.adminService)
      providers.push({ provide: ADMIN_WALLET_SERVICE, useValue: overrides.adminService });
    if (overrides.reconciliationService)
      providers.push({
        provide: WALLET_RECONCILIATION_SERVICE,
        useValue: overrides.reconciliationService,
      });
    if (overrides.authorization)
      providers.push({ provide: WALLET_AUTHORIZATION, useValue: overrides.authorization });
    return {
      module: WalletModule,
      controllers: [UserWalletController, AdminWalletController],
      providers: [
        ...providers,
        WalletPermissionGuard,
        { provide: APP_FILTER, useClass: WalletHttpFilter },
      ],
    };
  }
}
