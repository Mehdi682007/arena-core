import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminMatchResultService, MatchResultResolutionReasonCode } from '@arena-core/matches';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import { matchIdSchema, matchListQuerySchema, resolveMatchResultSchema } from './matches.dto';
import { MatchesPermissionGuard, RequireMatchPermission } from './matches-permission.guard';
import { ADMIN_MATCH_RESULT_SERVICE } from './matches.providers';

const safeAdmin = (context: Awaited<ReturnType<AdminMatchResultService['detail']>>) => ({
  matchId: context.match.id,
  status: context.match.status,
  participants: context.match.participants.map((participant) => ({
    side: participant.side,
    displayHandle: participant.snapshot.data.displayHandle,
  })),
  submissions: context.submissions.map((submission) => ({
    id: submission.id,
    side: context.match.participants.find((item) => item.id === submission.participantId)?.side,
    status: submission.status,
    result: submission.resultPayload,
    submittedAt: submission.submittedAt,
  })),
  result: context.result,
  resultConflictDeadlineAt: context.resultConflictDeadlineAt,
});

@Controller('admin/match-results')
@UseGuards(MatchesPermissionGuard)
export class AdminMatchResultsController {
  public constructor(
    @Inject(ADMIN_MATCH_RESULT_SERVICE) private readonly service: AdminMatchResultService,
  ) {}
  @Get('conflicts')
  @RequireMatchPermission('match_results.read')
  public async conflicts(@Query(new ZodBodyPipe(matchListQuerySchema)) query: { limit: number }) {
    return (await this.service.listConflicts(query.limit)).map((item) => safeAdmin(item));
  }
  @Get(':matchId')
  @RequireMatchPermission('match_results.read')
  public async detail(@Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string) {
    return safeAdmin(await this.service.detail(matchId));
  }
  @Post(':matchId/resolve')
  @RequireMatchPermission('match_results.resolve')
  @RateLimit('matches')
  public resolve(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('matchId', new ZodBodyPipe(matchIdSchema)) matchId: string,
    @Body(new ZodBodyPipe(resolveMatchResultSchema))
    body: {
      result?: unknown;
      submissionId?: string;
      reasonCode: MatchResultResolutionReasonCode;
      note?: string;
    },
  ) {
    return this.service.resolve(
      principal.userId,
      matchId,
      body.submissionId ? { submissionId: body.submissionId } : body.result,
      body.reasonCode,
      body.note,
    );
  }
}
