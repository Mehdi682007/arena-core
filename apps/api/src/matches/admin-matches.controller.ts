import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AdminMatchService, MatchRecord, MatchVoidReasonCode } from '@arena-core/matches';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import { matchIdSchema, matchListQuerySchema, voidMatchSchema } from './matches.dto';
import { MatchesPermissionGuard, RequireMatchPermission } from './matches-permission.guard';
import { ADMIN_MATCH_SERVICE } from './matches.providers';

const safeAdmin = (match: MatchRecord) => ({
  id: match.id,
  status: match.status,
  game: match.gameSnapshot.data,
  mode: match.modeSnapshot.data,
  ruleset: match.rulesetSnapshot.data,
  crossplay: match.crossplaySnapshot.data,
  participants: match.participants.map((participant) => ({
    side: participant.side,
    status: participant.status,
    displayHandle: participant.snapshot.data.displayHandle,
    platform: {
      key: participant.snapshot.data.platformKey,
      name: participant.snapshot.data.platformName,
    },
  })),
  readyDeadlineAt: match.readyDeadlineAt,
  createdAt: match.createdAt,
});
@Controller('admin/matches')
@UseGuards(MatchesPermissionGuard)
export class AdminMatchesController {
  public constructor(@Inject(ADMIN_MATCH_SERVICE) private readonly service: AdminMatchService) {}
  @Get()
  @RequireMatchPermission('matches.read')
  public async list(
    @Query(new ZodBodyPipe(matchListQuerySchema))
    query: {
      limit: number;
      status?: string;
    },
  ) {
    return (await this.service.list(query.limit, query.status)).map(safeAdmin);
  }
  @Get(':matchId')
  @RequireMatchPermission('matches.read')
  public async detail(@Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string) {
    const detail = await this.service.detail(matchId);
    return { match: safeAdmin(detail.match), audit: detail.audit };
  }
  @Post(':matchId/void')
  @RequireMatchPermission('matches.manage')
  @RateLimit('matches')
  @HttpCode(HttpStatus.NO_CONTENT)
  public void(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(voidMatchSchema))
    body: { reasonCode: MatchVoidReasonCode; note?: string },
  ) {
    return this.service.void(principal.userId, matchId, body.reasonCode, body.note);
  }
}
