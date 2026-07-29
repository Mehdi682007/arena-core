import { MatchResultError } from '../domain/match-result-errors';
import type { Clock } from '../ports/clock';
import type { MatchResultRepository } from '../ports/match-result-repository';
import {
  allowMatchEntry,
  type MatchEntryEligibilityPort,
} from '../ports/match-entry-eligibility-port';

export class MatchStartService {
  public constructor(
    private readonly repository: MatchResultRepository,
    private readonly clock: Clock,
    private readonly submissionTtlSeconds: number,
    private readonly entryEligibility: MatchEntryEligibilityPort = allowMatchEntry,
  ) {}
  public async start(matchId: string, userId: string) {
    const context = await this.repository.findForUser(userId, matchId);
    if (!context) throw new MatchResultError('MATCH_RESULT_NOT_FOUND');
    if (
      ['IN_PROGRESS', 'AWAITING_RESULT', 'RESULT_CONFLICT', 'COMPLETED'].includes(
        context.match.status,
      )
    )
      return context;
    if (
      context.match.status !== 'READY' ||
      context.match.participants.length !== 2 ||
      context.match.participants.some((participant) => participant.status !== 'READY')
    )
      throw new MatchResultError('MATCH_START_INVALID');
    await this.entryEligibility.assertMatchEntrySatisfied(matchId);
    const now = this.clock.now();
    const result = await this.repository.start(
      userId,
      matchId,
      now,
      new Date(now.getTime() + this.submissionTtlSeconds * 1000),
    );
    await this.entryEligibility.releaseMatchEntries(matchId);
    return result;
  }
}
