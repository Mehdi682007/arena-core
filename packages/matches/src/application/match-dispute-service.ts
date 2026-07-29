import { MatchDisputeError } from '../domain/match-dispute-errors';
import { buildResultSnapshot, validateClaim } from '../domain/match-dispute-policies';
import type {
  MatchDisputeReasonCode,
  MatchDisputeRecord,
  MatchDisputeView,
} from '../domain/match-dispute-types';
import type { Clock } from '../ports/clock';
import type { MatchDisputeRepository } from '../ports/match-dispute-repository';

const view = (item: MatchDisputeRecord): MatchDisputeView => ({
  id: item.id,
  status: item.status === 'OPEN' ? 'AWAITING_RESPONSE' : item.status,
  reasonCode: item.reasonCode,
  requestedOutcome: item.claimPayload.requestedOutcome,
  statement: item.claimPayload.statement,
  hasResponse: Boolean(item.response),
  ...(item.response ? { responseSubmittedAt: item.response.submittedAt } : {}),
  responseDeadlineAt: item.responseDeadlineAt,
  resolutionType: item.resolutionType,
  resolvedAt: item.resolvedAt,
  createdAt: item.createdAt,
});
export class MatchDisputeService {
  public constructor(
    private readonly repository: MatchDisputeRepository,
    private readonly clock: Clock,
    private readonly openTtlSeconds: number,
    private readonly responseTtlSeconds: number,
    private readonly reviewTtlSeconds: number,
    private readonly integration?: { disputeOpened(disputeId: string): Promise<void> },
  ) {}
  public async listMine(userId: string, matchId: string) {
    const context = await this.repository.loadForUser(userId, matchId);
    if (!context) throw new MatchDisputeError('MATCH_DISPUTE_NOT_FOUND');
    if (context.settlementExists || context.ratingApplicationExists)
      throw new MatchDisputeError('MATCH_DISPUTE_OPEN_NOT_ALLOWED');
    return context.disputes.map(view);
  }
  public async get(userId: string, matchId: string, disputeId: string) {
    const items = await this.listMine(userId, matchId);
    const item = items.find((candidate) => candidate.id === disputeId);
    if (!item) throw new MatchDisputeError('MATCH_DISPUTE_NOT_FOUND');
    return item;
  }
  public async open(
    userId: string,
    matchId: string,
    reasonCode: MatchDisputeReasonCode,
    input: unknown,
  ) {
    const context = await this.repository.loadForUser(userId, matchId);
    if (!context) throw new MatchDisputeError('MATCH_DISPUTE_NOT_FOUND');
    if (context.settlementExists || context.ratingApplicationExists)
      throw new MatchDisputeError('MATCH_DISPUTE_OPEN_NOT_ALLOWED');
    if (!['COMPLETED', 'RESULT_CONFLICT'].includes(context.resultContext.match.status))
      throw new MatchDisputeError('MATCH_DISPUTE_OPEN_NOT_ALLOWED');
    if (
      context.disputes.some((item) =>
        ['OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW'].includes(item.status),
      )
    )
      throw new MatchDisputeError('MATCH_DISPUTE_ALREADY_ACTIVE');
    const now = this.clock.now();
    const anchor =
      context.resultContext.completedAt ?? context.resultContext.resultConflictDeadlineAt;
    if (!anchor || now.getTime() > anchor.getTime() + this.openTtlSeconds * 1000)
      throw new MatchDisputeError('MATCH_DISPUTE_WINDOW_EXPIRED');
    const claim = validateClaim(reasonCode, input, context.resultContext);
    const owned = context.evidence.filter(
      (item) =>
        claim.evidenceIds.includes(item.id) &&
        item.submittedByUserId === userId &&
        item.matchId === matchId &&
        item.status === 'ACTIVE',
    );
    if (owned.length !== claim.evidenceIds.length)
      throw new MatchDisputeError('MATCH_DISPUTE_OPEN_NOT_ALLOWED');
    const dispute = await this.repository.createDispute({
      userId,
      matchId,
      reasonCode,
      claim,
      snapshot: buildResultSnapshot(context.resultContext),
      responseDeadlineAt: new Date(now.getTime() + this.responseTtlSeconds * 1000),
      reviewDeadlineAt: new Date(now.getTime() + this.reviewTtlSeconds * 1000),
      now,
    });
    await this.integration?.disputeOpened(dispute.id);
    return view(dispute);
  }
  public async respond(
    userId: string,
    matchId: string,
    disputeId: string,
    statement: string,
    evidenceIds: readonly string[],
  ) {
    if (
      !statement.trim() ||
      statement.length > 2000 ||
      evidenceIds.length > 10 ||
      new Set(evidenceIds).size !== evidenceIds.length
    )
      throw new MatchDisputeError('MATCH_DISPUTE_RESPONSE_NOT_ALLOWED');
    const context = await this.repository.loadForUser(userId, matchId);
    const dispute = context?.disputes.find((item) => item.id === disputeId);
    if (
      !context ||
      !dispute ||
      dispute.openedByUserId === userId ||
      dispute.status !== 'AWAITING_RESPONSE' ||
      dispute.responseDeadlineAt <= this.clock.now()
    )
      throw new MatchDisputeError('MATCH_DISPUTE_RESPONSE_NOT_ALLOWED');
    const owned = context.evidence.filter(
      (item) =>
        evidenceIds.includes(item.id) &&
        item.submittedByUserId === userId &&
        item.status === 'ACTIVE',
    );
    if (owned.length !== evidenceIds.length)
      throw new MatchDisputeError('MATCH_DISPUTE_RESPONSE_NOT_ALLOWED');
    return view(
      await this.repository.respond({
        userId,
        matchId,
        disputeId,
        statement: statement.trim(),
        evidenceIds,
        now: this.clock.now(),
      }),
    );
  }
  public async cancel(userId: string, matchId: string, disputeId: string): Promise<void> {
    const context = await this.repository.loadForUser(userId, matchId);
    const item = context?.disputes.find((candidate) => candidate.id === disputeId);
    if (!item) throw new MatchDisputeError('MATCH_DISPUTE_NOT_FOUND');
    if (item.status === 'CANCELLED') return;
    if (item.openedByUserId !== userId || item.status !== 'AWAITING_RESPONSE' || item.response)
      throw new MatchDisputeError('MATCH_DISPUTE_CANCEL_NOT_ALLOWED');
    await this.repository.cancel(userId, matchId, disputeId, this.clock.now());
  }
}
