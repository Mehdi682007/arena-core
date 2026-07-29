import { MatchDisputeError } from '../domain/match-dispute-errors';
import type { DisputeResolutionType } from '../domain/match-dispute-types';
import { validateAndCanonicalizeResult } from '../domain/match-result-policies';
import type { Clock } from '../ports/clock';
import type { MatchDisputeRepository } from '../ports/match-dispute-repository';

export class AdminMatchDisputeService {
  public constructor(
    private readonly repository: MatchDisputeRepository,
    private readonly clock: Clock,
    private readonly integration?: { disputeResolved(disputeId: string): Promise<void> },
  ) {}
  public list(limit = 50, status?: string, actorUserId?: string) {
    return this.repository.listAdmin(Math.min(Math.max(limit, 1), 100), status, actorUserId);
  }
  public async detail(disputeId: string) {
    const context = await this.repository.findAdmin(disputeId);
    if (!context) throw new MatchDisputeError('MATCH_DISPUTE_NOT_FOUND');
    return context;
  }
  public assignSelf(disputeId: string, actorUserId: string) {
    return this.repository.assignSelf(disputeId, actorUserId, this.clock.now());
  }
  public startReview(disputeId: string, actorUserId: string) {
    return this.repository.startReview(disputeId, actorUserId, this.clock.now());
  }
  public async resolve(
    disputeId: string,
    actorUserId: string,
    resolutionType: DisputeResolutionType,
    correctedResult: unknown,
    reasonCode: string,
    note?: string,
  ) {
    if (
      !reasonCode.trim() ||
      reasonCode.length > 64 ||
      (reasonCode === 'OTHER' && !note?.trim()) ||
      (note !== undefined && note.length > 500)
    )
      throw new MatchDisputeError('MATCH_DISPUTE_RESOLUTION_INVALID');
    const context = await this.repository.findAdmin(disputeId);
    const dispute = context?.disputes.find((item) => item.id === disputeId);
    if (
      !context ||
      !dispute ||
      dispute.status !== 'UNDER_REVIEW' ||
      dispute.assignedReviewerUserId !== actorUserId
    )
      throw new MatchDisputeError('MATCH_DISPUTE_RESOLUTION_INVALID');
    if ((resolutionType === 'CORRECT_RESULT') !== (correctedResult !== undefined))
      throw new MatchDisputeError('MATCH_DISPUTE_RESOLUTION_INVALID');
    const canonical =
      correctedResult === undefined
        ? undefined
        : validateAndCanonicalizeResult(correctedResult, context.resultContext.match);
    const resolved = await this.repository.resolve({
      disputeId,
      actorUserId,
      resolutionType,
      ...(canonical ? { correctedResult: canonical } : {}),
      reasonCode,
      ...(note === undefined ? {} : { note }),
      now: this.clock.now(),
    });
    await this.integration?.disputeResolved(disputeId);
    return resolved;
  }
  public expire(limit = 100) {
    return this.repository.expireResponses(this.clock.now(), Math.min(Math.max(limit, 1), 500));
  }
}
