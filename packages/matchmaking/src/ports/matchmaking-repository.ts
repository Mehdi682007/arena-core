import type {
  MatchmakingCreationContext,
  MatchmakingCriteria,
  MatchmakingProposal,
  MatchmakingRequest,
  MatchmakingRequestStatus,
  MatchmakingSearchScope,
} from '../domain/matchmaking-types';

export interface CreateMatchmakingRecord extends MatchmakingCreationContext {
  readonly criteria: MatchmakingCriteria;
  readonly searchScope: MatchmakingSearchScope;
  readonly expiresAt: Date;
}
export interface MatchmakingRepository {
  listUserRequests(userId: string, limit: number): Promise<readonly MatchmakingRequest[]>;
  findRequestForUser(userId: string, requestId: string): Promise<MatchmakingRequest | null>;
  findRequestById(requestId: string): Promise<MatchmakingRequest | null>;
  resolveCreationContext(
    userId: string,
    accountId: string,
    gameModeId: string,
    gameRulesetId: string,
  ): Promise<MatchmakingCreationContext | null>;
  findActiveRequestByUser(userId: string): Promise<MatchmakingRequest | null>;
  createRequest(input: CreateMatchmakingRecord): Promise<MatchmakingRequest>;
  transitionRequest(
    requestId: string,
    expectedVersion: number,
    status: MatchmakingRequestStatus,
    now: Date,
  ): Promise<MatchmakingRequest>;
  listCandidateRequests(
    source: MatchmakingRequest,
    limit: number,
  ): Promise<readonly MatchmakingRequest[]>;
  hasActiveProposal(requestId: string): Promise<boolean>;
  createProposalForPair(
    left: MatchmakingRequest,
    right: MatchmakingRequest,
    expiresAt: Date,
  ): Promise<MatchmakingProposal>;
  findCurrentProposalForUser(userId: string): Promise<MatchmakingProposal | null>;
  findProposalForUser(userId: string, proposalId: string): Promise<MatchmakingProposal | null>;
  acceptProposal(
    userId: string,
    proposalId: string,
    expectedVersion: number,
    now: Date,
  ): Promise<MatchmakingProposal>;
  rejectProposal(
    userId: string,
    proposalId: string,
    expectedVersion: number,
    now: Date,
  ): Promise<void>;
  cancelRequest(userId: string, requestId: string, now: Date): Promise<void>;
  expireRequests(now: Date, limit: number): Promise<number>;
  expireProposals(now: Date, limit: number): Promise<number>;
  listAdminRequests(limit: number): Promise<readonly MatchmakingRequest[]>;
  listAdminProposals(limit: number): Promise<readonly MatchmakingProposal[]>;
}
