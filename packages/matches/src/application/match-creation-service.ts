import { MatchError } from '../domain/match-errors';
import { buildSnapshots } from '../domain/match-snapshot';
import type { MatchRecord } from '../domain/match-types';
import type { Clock } from '../ports/clock';
import type { MatchRepository } from '../ports/match-repository';
import type { MatchTransactionManager } from '../ports/match-transaction-manager';

export class MatchCreationService {
  public constructor(
    private readonly repository: MatchRepository,
    private readonly transactions: MatchTransactionManager,
    private readonly clock: Clock,
    private readonly readyTtlSeconds = 120,
    private readonly integration?: { matchReady(matchId: string): Promise<void> },
  ) {}
  public async createMatchFromAcceptedProposal(proposalId: string): Promise<MatchRecord> {
    const existing = await this.repository.findByProposalId(proposalId);
    if (existing) return existing;
    const match = await this.transactions.transaction(async (repository) => {
      const duplicate = await repository.findByProposalId(proposalId);
      if (duplicate) return duplicate;
      const context = await repository.loadAcceptedProposalContext(proposalId);
      if (!context || context.proposalStatus !== 'ACCEPTED')
        throw new MatchError('MATCH_PROPOSAL_INVALID');
      buildSnapshots(context);
      try {
        return await repository.createMatch({
          context,
          readyDeadlineAt: new Date(this.clock.now().getTime() + this.readyTtlSeconds * 1_000),
        });
      } catch (error) {
        if (error instanceof MatchError && error.code === 'MATCH_CREATION_CONFLICT') {
          const winner = await repository.findByProposalId(proposalId);
          if (winner) return winner;
        }
        throw error;
      }
    });
    await this.integration?.matchReady(match.id);
    return match;
  }
  public async createMissingMatchesForAcceptedProposals(limit = 50): Promise<number> {
    const ids = await this.repository.listAcceptedProposalIdsWithoutMatch(
      Math.min(Math.max(limit, 1), 100),
    );
    for (const id of ids) await this.createMatchFromAcceptedProposal(id);
    return ids.length;
  }
}
