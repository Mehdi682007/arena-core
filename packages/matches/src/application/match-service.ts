import { MatchError } from '../domain/match-errors';
import type { Clock } from '../ports/clock';
import type { MatchRepository } from '../ports/match-repository';
import {
  allowMatchEntry,
  type MatchEntryEligibilityPort,
} from '../ports/match-entry-eligibility-port';
import { toMatchView } from './match-view';

export class MatchService {
  public constructor(
    private readonly repository: MatchRepository,
    private readonly clock: Clock,
    private readonly entryEligibility: MatchEntryEligibilityPort = allowMatchEntry,
  ) {}
  public async listMine(userId: string, limit = 50) {
    return (await this.repository.listForUser(userId, Math.min(Math.max(limit, 1), 100))).map(
      (match) => toMatchView(match, userId),
    );
  }
  public async getMine(userId: string, matchId: string) {
    const match = await this.repository.findForUser(userId, matchId);
    if (!match) throw new MatchError('MATCH_NOT_FOUND');
    return toMatchView(match, userId);
  }
  public async ready(userId: string, matchId: string) {
    const match = await this.repository.findForUser(userId, matchId);
    if (!match) throw new MatchError('MATCH_NOT_FOUND');
    const mine = match.participants.find((participant) => participant.userId === userId);
    if (!mine) throw new MatchError('MATCH_PARTICIPANT_NOT_FOUND');
    if (mine.status === 'READY') return toMatchView(match, userId);
    if (match.readyDeadlineAt <= this.clock.now())
      throw new MatchError('MATCH_READY_DEADLINE_EXPIRED');
    if (match.status !== 'AWAITING_READY') throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
    await this.entryEligibility.assertParticipantEntrySatisfied(matchId, mine.id);
    return toMatchView(await this.repository.markReady(userId, matchId, this.clock.now()), userId);
  }
  public async cancel(userId: string, matchId: string): Promise<void> {
    const match = await this.repository.findForUser(userId, matchId);
    if (!match) throw new MatchError('MATCH_NOT_FOUND');
    if (match.status === 'CANCELLED') return;
    if (match.status !== 'AWAITING_READY' && match.status !== 'CREATED')
      throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
    await this.repository.cancel(userId, matchId, this.clock.now());
  }
  public expireUnreadyMatches(limit = 100): Promise<number> {
    return this.repository.expireUnready(this.clock.now(), Math.min(Math.max(limit, 1), 500));
  }
}
