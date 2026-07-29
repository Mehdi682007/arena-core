import { MatchFinanceError } from '../domain/match-entry-errors';
import { assertEntrySatisfied, parseRequirement } from '../domain/match-entry-policies';
import type { Clock } from '../ports/clock';
import type { MatchFinanceRepository } from '../ports/match-finance-repository';

export class MatchEscrowService {
  public constructor(
    private readonly repository: MatchFinanceRepository,
    private readonly clock: Clock,
  ) {}
  public async assertParticipantEntrySatisfied(
    matchId: string,
    participantId: string,
  ): Promise<void> {
    const reservation = await this.repository.findByParticipant(matchId, participantId);
    if (reservation) {
      assertEntrySatisfied(reservation);
      return;
    }
    const context = await this.repository.findContextByParticipant(matchId, participantId);
    if (context && !parseRequirement(context.rulesetConfiguration).required) return;
    assertEntrySatisfied(null);
  }
  public async assertMatchEntrySatisfied(matchId: string): Promise<void> {
    const contexts = await this.repository.listContexts(matchId);
    if (contexts.length !== 2) throw new MatchFinanceError('MATCH_ENTRY_RESERVATION_STATE_INVALID');
    await Promise.all(
      contexts.map((context) =>
        this.assertParticipantEntrySatisfied(matchId, context.participantId),
      ),
    );
  }
  public async releaseMatch(matchId: string): Promise<void> {
    await this.assertMatchEntrySatisfied(matchId);
    await this.repository.releaseMatch(matchId, this.clock.now());
  }
}
