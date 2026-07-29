import { describe, expect, it, vi } from 'vitest';
import {
  MatchmakingEngine,
  MatchmakingProposalService,
  MatchmakingRequestService,
  type Clock,
  type MatchmakingProposal,
  type MatchmakingRepository,
  type MatchmakingRequest,
  type MatchmakingTransactionManager,
} from '../src';

const now = new Date('2026-07-25T12:00:00Z');
const clock: Clock = { now: () => now };
const request: MatchmakingRequest = {
  id: 'request-a',
  userId: 'user-a',
  userGameAccountId: 'account-a',
  gameId: 'game',
  gameModeId: 'mode',
  gameRulesetId: 'ruleset',
  gamePlatformId: 'pc',
  crossplayGroupId: 'group',
  status: 'SEARCHING',
  searchScope: 'CROSSPLAY_GROUP',
  criteria: { schemaVersion: 1, preferences: {} },
  priority: 0,
  accountVerified: true,
  catalogValid: true,
  createdAt: new Date('2026-07-25T11:00:00Z'),
  expiresAt: new Date('2026-07-25T12:15:00Z'),
  version: 2,
};
const candidate = {
  ...request,
  id: 'request-b',
  userId: 'user-b',
  userGameAccountId: 'account-b',
  createdAt: new Date('2026-07-25T10:00:00Z'),
};
const proposal: MatchmakingProposal = {
  id: 'proposal',
  status: 'PENDING',
  requestAId: request.id,
  requestBId: candidate.id,
  userAId: request.userId,
  userBId: candidate.userId,
  gameId: 'game',
  gameModeId: 'mode',
  gameRulesetId: 'ruleset',
  crossplayGroupId: 'group',
  expiresAt: new Date('2026-07-25T12:00:30Z'),
  acceptedAAt: null,
  acceptedBAt: null,
  version: 1,
};
function repository(): MatchmakingRepository {
  return {
    listUserRequests: vi.fn(async () => [request]),
    findRequestForUser: vi.fn(async () => request),
    findRequestById: vi.fn(async (id) => (id === request.id ? request : candidate)),
    resolveCreationContext: vi.fn(async () => ({
      userId: 'user-a',
      userGameAccountId: 'account-a',
      gameId: 'game',
      gameModeId: 'mode',
      gameRulesetId: 'ruleset',
      gamePlatformId: 'pc',
      crossplayGroupId: 'group',
      accountVerified: true,
      catalogValid: true,
    })),
    findActiveRequestByUser: vi.fn(async () => null),
    createRequest: vi.fn(async () => ({ ...request, status: 'PENDING' as const, version: 1 })),
    transitionRequest: vi.fn(async () => request),
    listCandidateRequests: vi.fn(async () => [candidate]),
    hasActiveProposal: vi.fn(async () => false),
    createProposalForPair: vi.fn(async () => proposal),
    findCurrentProposalForUser: vi.fn(async () => proposal),
    findProposalForUser: vi.fn(async () => proposal),
    acceptProposal: vi.fn(async () => ({ ...proposal, acceptedAAt: now, version: 2 })),
    rejectProposal: vi.fn(async () => undefined),
    cancelRequest: vi.fn(async () => undefined),
    expireRequests: vi.fn(async () => 2),
    expireProposals: vi.fn(async () => 1),
    listAdminRequests: vi.fn(async () => [request]),
    listAdminProposals: vi.fn(async () => [proposal]),
  };
}
const transactions = (repo: MatchmakingRepository): MatchmakingTransactionManager => ({
  transaction: (operation) => operation(repo),
});
describe('matchmaking engine', () => {
  it('selects a compatible candidate and creates one proposal', async () => {
    const repo = repository();
    await expect(
      new MatchmakingEngine(repo, transactions(repo), clock).findBestCandidate(request.id),
    ).resolves.toEqual(proposal);
    expect(repo.listCandidateRequests).toHaveBeenCalledWith(request, 50);
    expect(repo.createProposalForPair).toHaveBeenCalledOnce();
  });
  it('returns null when no candidate exists', async () => {
    const repo = repository();
    vi.mocked(repo.listCandidateRequests).mockResolvedValue([]);
    await expect(
      new MatchmakingEngine(repo, transactions(repo), clock).findBestCandidate(request.id),
    ).resolves.toBeNull();
  });
});
describe('request service', () => {
  it('derives catalog fields, starts searching and triggers bounded evaluation', async () => {
    const repo = repository();
    const engine = new MatchmakingEngine(repo, transactions(repo), clock);
    const service = new MatchmakingRequestService(repo, engine, clock);
    await service.createRequest({
      userId: 'user-a',
      userGameAccountId: 'account-a',
      gameModeId: 'mode',
      gameRulesetId: 'ruleset',
      criteria: { language: 'fa', region: 'middle-east' },
    });
    expect(repo.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'game',
        gamePlatformId: 'pc',
        crossplayGroupId: 'group',
      }),
    );
    expect(repo.transitionRequest).toHaveBeenCalledWith('request-a', 1, 'SEARCHING', now);
  });
  it('rejects an active request conflict', async () => {
    const repo = repository();
    vi.mocked(repo.findActiveRequestByUser).mockResolvedValue(request);
    const service = new MatchmakingRequestService(
      repo,
      new MatchmakingEngine(repo, transactions(repo), clock),
      clock,
    );
    await expect(
      service.createRequest({
        userId: 'user-a',
        userGameAccountId: 'account-a',
        gameModeId: 'mode',
        gameRulesetId: 'ruleset',
      }),
    ).rejects.toMatchObject({ code: 'MATCHMAKING_ACTIVE_REQUEST_EXISTS' });
  });
  it('delegates bounded cancellation and expiration', async () => {
    const repo = repository();
    const service = new MatchmakingRequestService(
      repo,
      new MatchmakingEngine(repo, transactions(repo), clock),
      clock,
    );
    await service.cancelMyRequest('user-a', 'request-a');
    await expect(service.expireRequests(9999)).resolves.toBe(2);
    expect(repo.cancelRequest).toHaveBeenCalledWith('user-a', 'request-a', now);
    expect(repo.expireRequests).toHaveBeenCalledWith(now, 500);
  });
});
describe('proposal service', () => {
  it('returns a privacy-safe current proposal', async () => {
    const result = await new MatchmakingProposalService(repository(), clock).currentProposal(
      'user-a',
    );
    expect(result).not.toHaveProperty('userBId');
    expect(result).not.toHaveProperty('requestBId');
    expect(result).toMatchObject({ myAcceptance: false, opponentAcceptance: false });
  });
  it('accepts own side idempotently through repository concurrency', async () => {
    await expect(
      new MatchmakingProposalService(repository(), clock).accept('user-a', 'proposal'),
    ).resolves.toMatchObject({ myAcceptance: true });
  });
  it('does not write again when this user already accepted', async () => {
    const repo = repository();
    vi.mocked(repo.findProposalForUser).mockResolvedValue({ ...proposal, acceptedAAt: now });
    await expect(
      new MatchmakingProposalService(repo, clock).accept('user-a', 'proposal'),
    ).resolves.toMatchObject({ myAcceptance: true });
    expect(repo.acceptProposal).not.toHaveBeenCalled();
  });
  it('rejects and restores through the repository transaction boundary', async () => {
    const repo = repository();
    await new MatchmakingProposalService(repo, clock).reject('user-a', 'proposal');
    expect(repo.rejectProposal).toHaveBeenCalledWith('user-a', 'proposal', 1, now);
  });
  it('treats an already rejected proposal as an idempotent success', async () => {
    const repo = repository();
    vi.mocked(repo.findProposalForUser).mockResolvedValue({ ...proposal, status: 'REJECTED' });
    await expect(
      new MatchmakingProposalService(repo, clock).reject('user-a', 'proposal'),
    ).resolves.toBeUndefined();
    expect(repo.rejectProposal).not.toHaveBeenCalled();
  });
});
