import { MatchError } from '../domain/match-errors';
import { validateVoidInput } from '../domain/match-policies';
import type { MatchVoidReasonCode } from '../domain/match-types';
import type { Clock } from '../ports/clock';
import type { MatchRepository } from '../ports/match-repository';

export class AdminMatchService {
  public constructor(
    private readonly repository: MatchRepository,
    private readonly clock: Clock,
  ) {}
  public list(limit = 50, status?: string) {
    return this.repository.listAdmin(Math.min(Math.max(limit, 1), 100), status);
  }
  public async detail(matchId: string) {
    const match = await this.repository.findById(matchId);
    if (!match) throw new MatchError('MATCH_NOT_FOUND');
    return { match, audit: await this.repository.listAudit(matchId) };
  }
  public async void(
    actorUserId: string,
    matchId: string,
    reasonCode: MatchVoidReasonCode,
    note?: string,
  ): Promise<void> {
    validateVoidInput({ reasonCode, ...(note === undefined ? {} : { note }) });
    const match = await this.repository.findById(matchId);
    if (!match) throw new MatchError('MATCH_NOT_FOUND');
    if (['CANCELLED', 'EXPIRED', 'VOIDED', 'COMPLETED'].includes(match.status)) {
      if (match.status === 'VOIDED') return;
      throw new MatchError('MATCH_STATE_TRANSITION_INVALID');
    }
    await this.repository.voidMatch(actorUserId, matchId, reasonCode, note, this.clock.now());
  }
}
