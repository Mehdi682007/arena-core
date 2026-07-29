import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type {
  MatchmakingProposalService,
  MatchmakingRepository,
  MatchmakingRequestService,
} from '@arena-core/matchmaking';
import { AdminMatchmakingController } from './admin-matchmaking.controller';
import { MatchmakingHttpFilter } from './matchmaking-http.filter';
import { MatchmakingPermissionGuard } from './matchmaking-permission.guard';
import { MatchmakingProposalController } from './matchmaking-proposal.controller';
import {
  MATCHMAKING_ADMIN_REPOSITORY,
  MATCHMAKING_AUTHORIZATION,
  MATCHMAKING_PROPOSAL_SERVICE,
  MATCHMAKING_REQUEST_SERVICE,
  type MatchmakingAuthorization,
  matchmakingProviders,
} from './matchmaking.providers';
import { MatchmakingRequestController } from './matchmaking-request.controller';

export interface MatchmakingModuleOverrides {
  readonly requestService?: MatchmakingRequestService;
  readonly proposalService?: MatchmakingProposalService;
  readonly adminRepository?: MatchmakingRepository;
  readonly authorization?: MatchmakingAuthorization;
}
@Module({})
export class MatchmakingModule {
  public static register(overrides: MatchmakingModuleOverrides = {}): DynamicModule {
    const replacements = new Set<symbol>();
    if (overrides.requestService) replacements.add(MATCHMAKING_REQUEST_SERVICE);
    if (overrides.proposalService) replacements.add(MATCHMAKING_PROPOSAL_SERVICE);
    if (overrides.adminRepository) replacements.add(MATCHMAKING_ADMIN_REPOSITORY);
    if (overrides.authorization) replacements.add(MATCHMAKING_AUTHORIZATION);
    const providers: Provider[] = matchmakingProviders.filter(
      (provider) =>
        typeof provider === 'function' ||
        !('provide' in provider) ||
        !replacements.has(provider.provide as symbol),
    );
    if (overrides.requestService)
      providers.push({ provide: MATCHMAKING_REQUEST_SERVICE, useValue: overrides.requestService });
    if (overrides.proposalService)
      providers.push({
        provide: MATCHMAKING_PROPOSAL_SERVICE,
        useValue: overrides.proposalService,
      });
    if (overrides.adminRepository)
      providers.push({
        provide: MATCHMAKING_ADMIN_REPOSITORY,
        useValue: overrides.adminRepository,
      });
    if (overrides.authorization)
      providers.push({ provide: MATCHMAKING_AUTHORIZATION, useValue: overrides.authorization });
    return {
      module: MatchmakingModule,
      controllers: [
        MatchmakingRequestController,
        MatchmakingProposalController,
        AdminMatchmakingController,
      ],
      providers: [
        ...providers,
        MatchmakingPermissionGuard,
        { provide: APP_FILTER, useClass: MatchmakingHttpFilter },
      ],
    };
  }
}
