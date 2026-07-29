import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminMatchDisputeService, DisputeResolutionType } from '@arena-core/matches';
import { CurrentPrincipal } from '../identity/http/decorators/current-principal.decorator';
import { ZodBodyPipe } from '../identity/http/dto/identity.dto';
import type { AuthenticatedPrincipal } from '../identity/http/identity-http.types';
import { RateLimit } from '../identity/http/rate-limit.interceptor';
import {
  disputeIdSchema,
  disputeListQuerySchema,
  emptyMatchActionSchema,
  resolveDisputeSchema,
} from './matches.dto';
import { MatchesPermissionGuard, RequireMatchPermission } from './matches-permission.guard';
import { ADMIN_MATCH_DISPUTE_SERVICE } from './matches.providers';

const summary = (item: Awaited<ReturnType<AdminMatchDisputeService['assignSelf']>>) => ({
  id: item.id,
  matchId: item.matchId,
  status: item.status,
  reasonCode: item.reasonCode,
  requestedOutcome: item.claimPayload.requestedOutcome,
  responseDeadlineAt: item.responseDeadlineAt,
  reviewDeadlineAt: item.reviewDeadlineAt,
  assigned: Boolean(item.assignedReviewerUserId),
  hasResponse: Boolean(item.response),
  resolutionType: item.resolutionType,
  createdAt: item.createdAt,
});

@Controller('admin/match-disputes')
@UseGuards(MatchesPermissionGuard)
export class AdminMatchDisputeController {
  public constructor(
    @Inject(ADMIN_MATCH_DISPUTE_SERVICE) private readonly service: AdminMatchDisputeService,
  ) {}
  @Get()
  @RequireMatchPermission('match_disputes.read')
  public list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodBodyPipe(disputeListQuerySchema))
    query: { limit: number; status?: string; assignedToMe?: boolean },
  ) {
    return this.service
      .list(query.limit, query.status, query.assignedToMe ? principal.userId : undefined)
      .then((items) => items.map(summary));
  }
  @Get(':disputeId')
  @RequireMatchPermission('match_disputes.read')
  public async detail(@Param('disputeId', new ZodBodyPipe(disputeIdSchema)) disputeId: string) {
    const context = await this.service.detail(disputeId);
    const dispute = context.disputes.find((item) => item.id === disputeId);
    return {
      dispute: dispute && {
        ...summary(dispute),
        claim: dispute.claimPayload,
        resultSnapshot: dispute.resultSnapshot,
        response: dispute.response
          ? {
              statement: dispute.response.statement,
              evidenceIds: dispute.response.evidenceIds,
              submittedAt: dispute.response.submittedAt,
            }
          : null,
      },
      participants: context.resultContext.match.participants.map((participant) => ({
        side: participant.side,
        displayHandle: participant.snapshot.data.displayHandle,
      })),
      evidence: context.evidence.map((item) => ({
        id: item.id,
        type: item.type,
        status: item.status,
        description: item.payload.description,
        capturedAt: item.capturedAt,
        submittedAt: item.submittedAt,
      })),
    };
  }
  @Post(':disputeId/assign-self')
  @RequireMatchPermission('match_disputes.assign')
  public assign(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('disputeId', new ZodBodyPipe(disputeIdSchema)) disputeId: string,
    @Body(new ZodBodyPipe(emptyMatchActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.service.assignSelf(disputeId, principal.userId).then(summary);
  }
  @Post(':disputeId/start-review')
  @RequireMatchPermission('match_disputes.review')
  public start(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('disputeId', new ZodBodyPipe(disputeIdSchema)) disputeId: string,
    @Body(new ZodBodyPipe(emptyMatchActionSchema)) body: Record<string, never>,
  ) {
    void body;
    return this.service.startReview(disputeId, principal.userId).then(summary);
  }
  @Post(':disputeId/resolve')
  @RequireMatchPermission('match_disputes.review')
  @RateLimit('matches')
  public resolve(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('disputeId', new ZodBodyPipe(disputeIdSchema)) disputeId: string,
    @Body(new ZodBodyPipe(resolveDisputeSchema))
    body: {
      resolutionType: DisputeResolutionType;
      correctedResult?: unknown;
      reasonCode: string;
      note?: string;
    },
  ) {
    return this.service
      .resolve(
        disputeId,
        principal.userId,
        body.resolutionType,
        body.correctedResult,
        body.reasonCode,
        body.note,
      )
      .then(summary);
  }
}
