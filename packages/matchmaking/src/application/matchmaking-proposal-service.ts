import { MatchmakingError } from '../domain/matchmaking-errors';
import type { MatchmakingProposal, MatchmakingProposalView } from '../domain/matchmaking-types';
import type { Clock } from '../ports/clock';
import type { MatchmakingRepository } from '../ports/matchmaking-repository';

function safe(proposal: MatchmakingProposal, userId: string): MatchmakingProposalView {
  const mineIsA = proposal.userAId === userId;
  return {
    id: proposal.id,
    status: proposal.status,
    expiresAt: proposal.expiresAt,
    gameId: proposal.gameId,
    gameModeId: proposal.gameModeId,
    gameRulesetId: proposal.gameRulesetId,
    crossplayGroupId: proposal.crossplayGroupId,
    myAcceptance: mineIsA ? proposal.acceptedAAt !== null : proposal.acceptedBAt !== null,
    opponentAcceptance: mineIsA ? proposal.acceptedBAt !== null : proposal.acceptedAAt !== null,
  };
}
export class MatchmakingProposalService {
  public constructor(
    private readonly repository: MatchmakingRepository,
    private readonly clock: Clock,
  ) {}
  public async currentProposal(userId: string): Promise<MatchmakingProposalView | null> {
    const proposal = await this.repository.findCurrentProposalForUser(userId);
    return proposal ? safe(proposal, userId) : null;
  }
  public async accept(userId: string, proposalId: string): Promise<MatchmakingProposalView> {
    const proposal = await this.repository.findProposalForUser(userId, proposalId);
    if (!proposal) throw new MatchmakingError('MATCHMAKING_PROPOSAL_NOT_FOUND');
    const alreadyAccepted =
      proposal.userAId === userId
        ? proposal.acceptedAAt !== null
        : proposal.userBId === userId && proposal.acceptedBAt !== null;
    if (alreadyAccepted) return safe(proposal, userId);
    if (proposal.expiresAt <= this.clock.now())
      throw new MatchmakingError('MATCHMAKING_PROPOSAL_EXPIRED');
    if (proposal.status !== 'PENDING')
      throw new MatchmakingError('MATCHMAKING_PROPOSAL_STATE_INVALID');
    return safe(
      await this.repository.acceptProposal(userId, proposalId, proposal.version, this.clock.now()),
      userId,
    );
  }
  public async reject(userId: string, proposalId: string): Promise<void> {
    const proposal = await this.repository.findProposalForUser(userId, proposalId);
    if (!proposal) throw new MatchmakingError('MATCHMAKING_PROPOSAL_NOT_FOUND');
    if (proposal.status === 'REJECTED') return;
    if (proposal.status !== 'PENDING')
      throw new MatchmakingError('MATCHMAKING_PROPOSAL_STATE_INVALID');
    await this.repository.rejectProposal(userId, proposalId, proposal.version, this.clock.now());
  }
  public expireProposals(limit = 100): Promise<number> {
    return this.repository.expireProposals(this.clock.now(), Math.min(Math.max(limit, 1), 500));
  }
}
