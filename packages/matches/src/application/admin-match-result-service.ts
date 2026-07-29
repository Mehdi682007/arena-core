import { MatchResultError } from '../domain/match-result-errors';
import {
  validateAndCanonicalizeResult,
  validateResolutionInput,
} from '../domain/match-result-policies';
import type { MatchResultResolutionReasonCode } from '../domain/match-result-types';
import type { Clock } from '../ports/clock';
import type { MatchResultRepository } from '../ports/match-result-repository';

export class AdminMatchResultService {
  public constructor(
    private readonly repository: MatchResultRepository,
    private readonly clock: Clock,
  ) {}
  public listConflicts(limit = 50) {
    return this.repository.listConflicts(Math.min(Math.max(limit, 1), 100));
  }
  public async detail(matchId: string) {
    const context = await this.repository.findForAdmin(matchId);
    if (!context) throw new MatchResultError('MATCH_RESULT_NOT_FOUND');
    return context;
  }
  public async resolve(
    actorUserId: string,
    matchId: string,
    input: unknown,
    reasonCode: MatchResultResolutionReasonCode,
    note?: string,
  ) {
    validateResolutionInput(reasonCode, note);
    const context = await this.repository.findForAdmin(matchId);
    if (context?.settlementExists || context?.ratingApplicationExists)
      throw new MatchResultError('MATCH_RESULT_RESOLUTION_INVALID');
    if (!context || context.match.status !== 'RESULT_CONFLICT')
      throw new MatchResultError('MATCH_RESULT_CONFLICT_NOT_FOUND');
    const submissionId =
      typeof input === 'object' &&
      input !== null &&
      'submissionId' in input &&
      typeof input.submissionId === 'string'
        ? input.submissionId
        : null;
    const selected = submissionId
      ? context.submissions.find((submission) => submission.id === submissionId)
      : null;
    if (submissionId && !selected) throw new MatchResultError('MATCH_RESULT_RESOLUTION_INVALID');
    const payload = selected
      ? selected.resultPayload
      : validateAndCanonicalizeResult(input, context.match);
    return this.repository.resolve(
      actorUserId,
      matchId,
      payload,
      reasonCode,
      note,
      this.clock.now(),
    );
  }
}
