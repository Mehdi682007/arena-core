import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { MatchmakingRepository } from '@arena-core/matchmaking';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import { matchmakingLimitSchema } from './matchmaking.dto';
import {
  MatchmakingPermissionGuard,
  RequireMatchmakingPermission,
} from './matchmaking-permission.guard';
import { MATCHMAKING_ADMIN_REPOSITORY } from './matchmaking.providers';

@Controller('admin/matchmaking')
@UseGuards(MatchmakingPermissionGuard)
@RequireMatchmakingPermission('matchmaking.read')
export class AdminMatchmakingController {
  public constructor(
    @Inject(MATCHMAKING_ADMIN_REPOSITORY) private readonly repository: MatchmakingRepository,
  ) {}
  @Get('requests')
  public async requests(@Query('limit', new ZodBodyPipe(matchmakingLimitSchema)) limit = 50) {
    return (await this.repository.listAdminRequests(limit)).map((item) => ({
      id: item.id,
      status: item.status,
      gameId: item.gameId,
      gameModeId: item.gameModeId,
      gameRulesetId: item.gameRulesetId,
      crossplayGroupId: item.crossplayGroupId,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
    }));
  }
  @Get('proposals')
  public async proposals(@Query('limit', new ZodBodyPipe(matchmakingLimitSchema)) limit = 50) {
    return (await this.repository.listAdminProposals(limit)).map((item) => ({
      id: item.id,
      status: item.status,
      gameId: item.gameId,
      gameModeId: item.gameModeId,
      gameRulesetId: item.gameRulesetId,
      crossplayGroupId: item.crossplayGroupId,
      expiresAt: item.expiresAt,
    }));
  }
}
