import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type {
  AdminMatchFinanceService,
  AdminMatchSettlementService,
  MatchEntryReservationService,
  MatchSettlementReconciliationService,
  MatchSettlementService,
} from '@arena-core/match-finance';
import type { MatchEntryEligibilityPort } from '@arena-core/matches';
import { AdminMatchFinanceController } from './admin-match-finance.controller';
import { MatchFinanceHttpFilter } from './match-finance-http.filter';
import { MatchFinancePermissionGuard } from './match-finance-permission.guard';
import {
  ADMIN_MATCH_FINANCE_SERVICE,
  MATCH_ENTRY_ELIGIBILITY,
  MATCH_ENTRY_RESERVATION_SERVICE,
  MATCH_FINANCE_AUTHORIZATION,
  MATCH_SETTLEMENT_SERVICE,
  ADMIN_MATCH_SETTLEMENT_SERVICE,
  MATCH_SETTLEMENT_RECONCILIATION_SERVICE,
  matchFinanceProviders,
  type MatchFinanceAuthorization,
} from './match-finance.providers';
import { UserMatchFinanceController } from './user-match-finance.controller';
import { MatchSettlementController } from './settlements/match-settlement.controller';
import { AdminMatchSettlementController } from './settlements/admin-match-settlement.controller';

export interface MatchFinanceModuleOverrides {
  reservationService?: MatchEntryReservationService;
  adminService?: AdminMatchFinanceService;
  eligibility?: MatchEntryEligibilityPort;
  authorization?: MatchFinanceAuthorization;
  settlementService?: MatchSettlementService;
  adminSettlementService?: AdminMatchSettlementService;
  settlementReconciliationService?: MatchSettlementReconciliationService;
}

@Global()
@Module({})
export class MatchFinanceModule {
  public static register(overrides: MatchFinanceModuleOverrides = {}): DynamicModule {
    const replacements = new Set<symbol>();
    if (overrides.reservationService) replacements.add(MATCH_ENTRY_RESERVATION_SERVICE);
    if (overrides.adminService) replacements.add(ADMIN_MATCH_FINANCE_SERVICE);
    if (overrides.eligibility) replacements.add(MATCH_ENTRY_ELIGIBILITY);
    if (overrides.authorization) replacements.add(MATCH_FINANCE_AUTHORIZATION);
    if (overrides.settlementService) replacements.add(MATCH_SETTLEMENT_SERVICE);
    if (overrides.adminSettlementService) replacements.add(ADMIN_MATCH_SETTLEMENT_SERVICE);
    if (overrides.settlementReconciliationService)
      replacements.add(MATCH_SETTLEMENT_RECONCILIATION_SERVICE);
    const providers: Provider[] = matchFinanceProviders.filter(
      (provider) =>
        typeof provider === 'function' ||
        !('provide' in provider) ||
        !replacements.has(provider.provide as symbol),
    );
    if (overrides.reservationService)
      providers.push({
        provide: MATCH_ENTRY_RESERVATION_SERVICE,
        useValue: overrides.reservationService,
      });
    if (overrides.adminService)
      providers.push({ provide: ADMIN_MATCH_FINANCE_SERVICE, useValue: overrides.adminService });
    if (overrides.eligibility)
      providers.push({ provide: MATCH_ENTRY_ELIGIBILITY, useValue: overrides.eligibility });
    if (overrides.authorization)
      providers.push({ provide: MATCH_FINANCE_AUTHORIZATION, useValue: overrides.authorization });
    if (overrides.settlementService)
      providers.push({ provide: MATCH_SETTLEMENT_SERVICE, useValue: overrides.settlementService });
    if (overrides.adminSettlementService)
      providers.push({
        provide: ADMIN_MATCH_SETTLEMENT_SERVICE,
        useValue: overrides.adminSettlementService,
      });
    if (overrides.settlementReconciliationService)
      providers.push({
        provide: MATCH_SETTLEMENT_RECONCILIATION_SERVICE,
        useValue: overrides.settlementReconciliationService,
      });
    return {
      module: MatchFinanceModule,
      controllers: [
        UserMatchFinanceController,
        AdminMatchFinanceController,
        MatchSettlementController,
        AdminMatchSettlementController,
      ],
      providers: [
        ...providers,
        MatchFinancePermissionGuard,
        { provide: APP_FILTER, useClass: MatchFinanceHttpFilter },
      ],
      exports: [MATCH_ENTRY_ELIGIBILITY],
    };
  }
}
