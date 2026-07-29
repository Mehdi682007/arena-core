import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  AdminOperationError,
  type AdminSearchService,
  type AdminTimelineService,
  type AuditQueryService,
  type SupportOperationService,
} from '@arena-core/admin-operations';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { PrincipalRequest } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  auditQuerySchema,
  emptyBodySchema,
  idSchema,
  searchQuerySchema,
  sourceIdSchema,
  sourceSchema,
  timelineQuerySchema,
} from './admin-operations.dto';
import {
  AdminOperationsPermissionGuard,
  AllowAdminCapabilities,
  RequireAdminOperationsPermission,
} from './admin-operations-permission.guard';
import {
  ADMIN_SEARCH_SERVICE,
  ADMIN_TIMELINE_SERVICE,
  AUDIT_QUERY_SERVICE,
  SUPPORT_OPERATION_SERVICE,
  ADMIN_OPERATIONS_AUTHORIZATION,
  type AdminOperationsAuthorization,
} from './admin-operations.providers';
import { API_CONFIG } from '../config/config.module';
import type { ApiServiceConfig } from '@arena-core/config';
import { configFingerprint } from '@arena-core/config';
import { DatabaseService } from '../database/database.service';
import { RuntimeState } from '../platform/runtime-state';
@Controller('admin')
@UseGuards(AdminOperationsPermissionGuard)
export class AdminOperationsController {
  public constructor(
    @Inject(AUDIT_QUERY_SERVICE) private readonly audit: AuditQueryService,
    @Inject(ADMIN_SEARCH_SERVICE) private readonly searchService: AdminSearchService,
    @Inject(ADMIN_TIMELINE_SERVICE) private readonly timeline: AdminTimelineService,
    @Inject(SUPPORT_OPERATION_SERVICE) private readonly support: SupportOperationService,
    @Inject(API_CONFIG) private readonly config: ApiServiceConfig,
    private readonly database: DatabaseService,
    private readonly runtimeState: RuntimeState,
    @Inject(ADMIN_OPERATIONS_AUTHORIZATION)
    private readonly authorization: AdminOperationsAuthorization,
  ) {}
  @Get('capabilities')
  @AllowAdminCapabilities()
  public async capabilities(@Req() request: PrincipalRequest) {
    const userId = request.principal?.userId;
    if (!userId) throw new AdminOperationError('ADMIN_OPERATIONS_UNAVAILABLE');
    const allowed = new Set([
      'audit.read',
      'support.read',
      'support.manage',
      'timeline.read',
      'diagnostics.read',
      'notifications.read',
      'notifications.retry',
      'notifications.manage',
    ]);
    const permissions = (await this.authorization.listPermissions?.(userId)) ?? [];
    return { permissions: permissions.filter((permission) => allowed.has(permission)).sort() };
  }
  @Get('diagnostics')
  @RequireAdminOperationsPermission('diagnostics.read')
  public async diagnostics() {
    return {
      service: 'api',
      version: this.config.runtime.version,
      environment: this.config.hardening.environment,
      buildSha: this.config.hardening.operations.buildSha,
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: {
        database: await this.database.getStatus(),
        smtp: this.config.email.enabled ? 'configured' : 'disabled',
      },
      shuttingDown: this.runtimeState.shuttingDown,
      migrationMode: this.config.hardening.operations.migrationMode,
      fingerprint: configFingerprint(this.config.hardening, {
        databaseEnabled: this.config.database.enabled,
        smtpEnabled: this.config.email.enabled,
      }),
    };
  }
  @Get('audit')
  @RequireAdminOperationsPermission('audit.read')
  public listAudit(
    @Query(new ZodBodyPipe(auditQuerySchema)) query: Parameters<AuditQueryService['list']>[0],
  ) {
    return this.audit.list(query);
  }
  @Get('audit/:id')
  @RequireAdminOperationsPermission('audit.read')
  public auditDetail(@Param('id', new ZodBodyPipe(idSchema)) id: string) {
    return this.audit.detail(id);
  }
  @Get('search')
  @RequireAdminOperationsPermission('support.read')
  public search(
    @Query(new ZodBodyPipe(searchQuerySchema))
    query: {
      scope: Parameters<AdminSearchService['search']>[0];
      term: string;
      limit: number;
    },
  ) {
    return this.searchService.search(query.scope, query.term, query.limit);
  }
  @Get('users/:id/timeline')
  @RequireAdminOperationsPermission('timeline.read')
  public userTimeline(
    @Param('id', new ZodBodyPipe(idSchema)) id: string,
    @Query(new ZodBodyPipe(timelineQuerySchema)) query: { limit: number },
  ) {
    return this.timeline.user(id, query.limit);
  }
  @Get('matches/:id/timeline')
  @RequireAdminOperationsPermission('timeline.read')
  public matchTimeline(
    @Param('id', new ZodBodyPipe(idSchema)) id: string,
    @Query(new ZodBodyPipe(timelineQuerySchema)) query: { limit: number },
  ) {
    return this.timeline.match(id, query.limit);
  }
  @Post('support/notifications/:id/retry')
  @RateLimit('token')
  @RequireAdminOperationsPermission('support.manage')
  public retry(
    @Req() request: PrincipalRequest,
    @Param('id', new ZodBodyPipe(idSchema)) id: string,
    @Body(new ZodBodyPipe(emptyBodySchema)) body: Record<string, never>,
  ) {
    void body;
    return this.support.retry(this.actor(request), id);
  }
  @Post('support/recovery/:sourceType/:sourceId')
  @RateLimit('token')
  @RequireAdminOperationsPermission('support.manage')
  public recover(
    @Req() request: PrincipalRequest,
    @Param('sourceType', new ZodBodyPipe(sourceSchema)) sourceType: string,
    @Param('sourceId', new ZodBodyPipe(sourceIdSchema)) sourceId: string,
    @Body(new ZodBodyPipe(emptyBodySchema)) body: Record<string, never>,
  ) {
    void body;
    return this.support.recover(this.actor(request), sourceType, sourceId);
  }
  private actor(request: PrincipalRequest) {
    if (!request.principal) throw new AdminOperationError('ADMIN_OPERATIONS_UNAVAILABLE');
    return request.principal.userId;
  }
}
