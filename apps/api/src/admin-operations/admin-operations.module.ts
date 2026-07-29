import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type {
  AdminSearchService,
  AdminTimelineService,
  AuditQueryService,
  SupportOperationService,
} from '@arena-core/admin-operations';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsHttpFilter } from './admin-operations-http.filter';
import { AdminOperationsPermissionGuard } from './admin-operations-permission.guard';
import {
  ADMIN_OPERATIONS_AUTHORIZATION,
  ADMIN_SEARCH_SERVICE,
  ADMIN_TIMELINE_SERVICE,
  AUDIT_QUERY_SERVICE,
  SUPPORT_OPERATION_SERVICE,
  adminOperationsProviders,
  type AdminOperationsAuthorization,
} from './admin-operations.providers';
export interface AdminOperationsModuleOverrides {
  audit?: AuditQueryService;
  search?: AdminSearchService;
  timeline?: AdminTimelineService;
  support?: SupportOperationService;
  authorization?: AdminOperationsAuthorization;
}
@Module({})
export class AdminOperationsModule {
  public static register(overrides: AdminOperationsModuleOverrides = {}): DynamicModule {
    const values = new Map<symbol, object | undefined>([
      [AUDIT_QUERY_SERVICE, overrides.audit],
      [ADMIN_SEARCH_SERVICE, overrides.search],
      [ADMIN_TIMELINE_SERVICE, overrides.timeline],
      [SUPPORT_OPERATION_SERVICE, overrides.support],
      [ADMIN_OPERATIONS_AUTHORIZATION, overrides.authorization],
    ]);
    const replaced = new Set([...values].filter(([, value]) => value).map(([key]) => key));
    const providers: Provider[] = adminOperationsProviders.filter(
      (provider) =>
        typeof provider === 'function' ||
        !('provide' in provider) ||
        !replaced.has(provider.provide as symbol),
    );
    for (const [provide, useValue] of values) if (useValue) providers.push({ provide, useValue });
    return {
      module: AdminOperationsModule,
      controllers: [AdminOperationsController],
      providers: [
        ...providers,
        AdminOperationsPermissionGuard,
        { provide: APP_FILTER, useClass: AdminOperationsHttpFilter },
      ],
    };
  }
}
