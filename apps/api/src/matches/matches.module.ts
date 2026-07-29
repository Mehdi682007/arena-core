import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type {
  AdminMatchDisputeService,
  AdminMatchResultService,
  AdminMatchService,
  MatchCreationService,
  MatchDisputeService,
  MatchEvidenceService,
  MatchResultService,
  MatchService,
  MatchStartService,
} from '@arena-core/matches';
import { AdminMatchDisputeController } from './admin-match-dispute.controller';
import { AdminMatchResultsController } from './admin-match-results.controller';
import { AdminMatchesController } from './admin-matches.controller';
import { MatchesHttpFilter } from './matches-http.filter';
import { MatchesPermissionGuard } from './matches-permission.guard';
import {
  ADMIN_MATCH_DISPUTE_SERVICE,
  ADMIN_MATCH_SERVICE,
  ADMIN_MATCH_RESULT_SERVICE,
  MATCH_CREATION_SERVICE,
  MATCH_DISPUTE_SERVICE,
  MATCH_EVIDENCE_SERVICE,
  MATCH_RESULT_SERVICE,
  MATCH_SERVICE,
  MATCH_START_SERVICE,
  MATCHES_AUTHORIZATION,
  matchesProviders,
  type MatchesAuthorization,
} from './matches.providers';
import { MatchDisputeController } from './match-dispute.controller';
import { MatchEvidenceController } from './match-evidence.controller';
import { UserMatchesController } from './user-matches.controller';
import { UserMatchResultsController } from './user-match-results.controller';

export interface MatchesModuleOverrides {
  readonly creationService?: MatchCreationService;
  readonly matchService?: MatchService;
  readonly adminService?: AdminMatchService;
  readonly authorization?: MatchesAuthorization;
  readonly startService?: MatchStartService;
  readonly resultService?: MatchResultService;
  readonly adminResultService?: AdminMatchResultService;
  readonly evidenceService?: MatchEvidenceService;
  readonly disputeService?: MatchDisputeService;
  readonly adminDisputeService?: AdminMatchDisputeService;
}
@Global()
@Module({})
export class MatchesModule {
  public static register(overrides: MatchesModuleOverrides = {}): DynamicModule {
    const replacements = new Set<symbol>();
    if (overrides.creationService) replacements.add(MATCH_CREATION_SERVICE);
    if (overrides.matchService) replacements.add(MATCH_SERVICE);
    if (overrides.adminService) replacements.add(ADMIN_MATCH_SERVICE);
    if (overrides.authorization) replacements.add(MATCHES_AUTHORIZATION);
    if (overrides.startService) replacements.add(MATCH_START_SERVICE);
    if (overrides.resultService) replacements.add(MATCH_RESULT_SERVICE);
    if (overrides.adminResultService) replacements.add(ADMIN_MATCH_RESULT_SERVICE);
    if (overrides.evidenceService) replacements.add(MATCH_EVIDENCE_SERVICE);
    if (overrides.disputeService) replacements.add(MATCH_DISPUTE_SERVICE);
    if (overrides.adminDisputeService) replacements.add(ADMIN_MATCH_DISPUTE_SERVICE);
    const providers: Provider[] = matchesProviders.filter(
      (provider) =>
        typeof provider === 'function' ||
        !('provide' in provider) ||
        !replacements.has(provider.provide as symbol),
    );
    if (overrides.creationService)
      providers.push({ provide: MATCH_CREATION_SERVICE, useValue: overrides.creationService });
    if (overrides.matchService)
      providers.push({ provide: MATCH_SERVICE, useValue: overrides.matchService });
    if (overrides.adminService)
      providers.push({ provide: ADMIN_MATCH_SERVICE, useValue: overrides.adminService });
    if (overrides.authorization)
      providers.push({ provide: MATCHES_AUTHORIZATION, useValue: overrides.authorization });
    if (overrides.startService)
      providers.push({ provide: MATCH_START_SERVICE, useValue: overrides.startService });
    if (overrides.resultService)
      providers.push({ provide: MATCH_RESULT_SERVICE, useValue: overrides.resultService });
    if (overrides.adminResultService)
      providers.push({
        provide: ADMIN_MATCH_RESULT_SERVICE,
        useValue: overrides.adminResultService,
      });
    if (overrides.evidenceService)
      providers.push({ provide: MATCH_EVIDENCE_SERVICE, useValue: overrides.evidenceService });
    if (overrides.disputeService)
      providers.push({ provide: MATCH_DISPUTE_SERVICE, useValue: overrides.disputeService });
    if (overrides.adminDisputeService)
      providers.push({
        provide: ADMIN_MATCH_DISPUTE_SERVICE,
        useValue: overrides.adminDisputeService,
      });
    return {
      module: MatchesModule,
      controllers: [
        UserMatchesController,
        UserMatchResultsController,
        AdminMatchesController,
        AdminMatchResultsController,
        MatchEvidenceController,
        MatchDisputeController,
        AdminMatchDisputeController,
      ],
      providers: [
        ...providers,
        MatchesPermissionGuard,
        { provide: APP_FILTER, useClass: MatchesHttpFilter },
      ],
      exports: [MATCH_CREATION_SERVICE],
    };
  }
}
