import { MatchResultError } from '../domain/match-result-errors';
import { validateAndCanonicalizeResult } from '../domain/match-result-policies';
import type { Clock } from '../ports/clock';
import type { MatchResultRepository } from '../ports/match-result-repository';
import { toResultView } from './match-result-view';

export class MatchResultService {
  public constructor(
    private readonly repository: MatchResultRepository,
    private readonly clock: Clock,
    private readonly conflictTtlSeconds: number,
    private readonly integration?: { resultFinalized(matchId: string): Promise<void> },
  ) {}
  public async submit(matchId: string, userId: string, input: unknown) {
    const context = await this.repository.findForUser(userId, matchId);
    if (!context) throw new MatchResultError('MATCH_RESULT_NOT_FOUND');
    if (context.result && context.result.status !== 'CONFLICT')
      throw new MatchResultError('MATCH_RESULT_ALREADY_FINALIZED');
    if (!['IN_PROGRESS', 'AWAITING_RESULT'].includes(context.match.status))
      throw new MatchResultError('MATCH_RESULT_SUBMISSION_NOT_ALLOWED');
    const now = this.clock.now();
    if (!context.resultSubmissionDeadlineAt || context.resultSubmissionDeadlineAt <= now)
      throw new MatchResultError('MATCH_RESULT_SUBMISSION_DEADLINE_EXPIRED');
    const payload = validateAndCanonicalizeResult(input, context.match);
    const result = await this.repository.submit(
      userId,
      matchId,
      payload,
      now,
      new Date(now.getTime() + this.conflictTtlSeconds * 1000),
    );
    if (result.result) await this.integration?.resultFinalized(matchId);
    return toResultView(result, userId);
  }
  public async withdraw(matchId: string, userId: string): Promise<void> {
    const context = await this.repository.findForUser(userId, matchId);
    if (!context) throw new MatchResultError('MATCH_RESULT_NOT_FOUND');
    if (
      context.result ||
      context.submissions.some((submission) => submission.submittedByUserId !== userId)
    )
      throw new MatchResultError('MATCH_RESULT_WITHDRAW_NOT_ALLOWED');
    await this.repository.withdraw(userId, matchId, this.clock.now());
  }
  public async get(matchId: string, userId: string) {
    const context = await this.repository.findForUser(userId, matchId);
    if (!context) throw new MatchResultError('MATCH_RESULT_NOT_FOUND');
    return toResultView(context, userId);
  }
  public expire(limit = 100): Promise<number> {
    const now = this.clock.now();
    return this.repository.expire(
      now,
      Math.min(Math.max(limit, 1), 500),
      new Date(now.getTime() + this.conflictTtlSeconds * 1000),
    );
  }
}
