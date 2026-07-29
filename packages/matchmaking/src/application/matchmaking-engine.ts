import { evaluateCompatibility } from '../domain/compatibility';
import type { MatchmakingProposal } from '../domain/matchmaking-types';
import type { Clock } from '../ports/clock';
import type { MatchmakingRepository } from '../ports/matchmaking-repository';
import type { MatchmakingTransactionManager } from '../ports/matchmaking-transaction-manager';

export class MatchmakingEngine {
  public constructor(
    private readonly repository: MatchmakingRepository,
    private readonly transactions: MatchmakingTransactionManager,
    private readonly clock: Clock,
    private readonly candidateLimit = 50,
    private readonly proposalTtlSeconds = 30,
    private readonly integration?: { proposalCreated(proposalId: string): Promise<void> },
  ) {}
  public async findBestCandidate(requestId: string): Promise<MatchmakingProposal | null> {
    const source = await this.repository.findRequestById(requestId);
    if (!source || source.status !== 'SEARCHING') return null;
    const now = this.clock.now();
    const evaluated = await Promise.all(
      (await this.repository.listCandidateRequests(source, this.candidateLimit)).map(
        async (candidate) => ({
          candidate,
          result: evaluateCompatibility(
            source,
            candidate,
            now,
            (await this.repository.hasActiveProposal(source.id)) ||
              (await this.repository.hasActiveProposal(candidate.id)),
          ),
        }),
      ),
    );
    const best = evaluated
      .filter(({ result }) => result.compatible)
      .sort(
        (left, right) =>
          right.result.score - left.result.score ||
          left.candidate.createdAt.getTime() - right.candidate.createdAt.getTime() ||
          left.candidate.id.localeCompare(right.candidate.id),
      )[0];
    if (!best) return null;
    const proposal = await this.transactions.transaction(async (repository) => {
      const left = await repository.findRequestById(source.id);
      const right = await repository.findRequestById(best.candidate.id);
      if (!left || !right || !evaluateCompatibility(left, right, this.clock.now()).compatible)
        return null;
      return repository.createProposalForPair(
        left,
        right,
        new Date(this.clock.now().getTime() + this.proposalTtlSeconds * 1_000),
      );
    });
    if (proposal) await this.integration?.proposalCreated(proposal.id);
    return proposal;
  }
}
