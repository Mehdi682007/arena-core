import { describe, expect, it, vi } from 'vitest';
import {
  AdminMatchService,
  buildSnapshots,
  MatchCreationService,
  MatchError,
  MatchService,
  type Clock,
  type MatchRecord,
  type MatchRepository,
  type MatchEntryEligibilityPort,
  type MatchTransactionManager,
} from '../src';
import { context } from './fixtures';

const now = new Date('2026-07-26T12:00:00Z');
const clock: Clock = { now: () => now };
const snapshots = buildSnapshots(context);
const record: MatchRecord = {
  id: 'match',
  matchmakingProposalId: 'proposal',
  gameId: 'game',
  gameModeId: 'mode',
  gameRulesetId: 'ruleset',
  crossplayGroupId: 'group',
  status: 'AWAITING_READY',
  gameSnapshot: snapshots.game,
  modeSnapshot: snapshots.mode,
  rulesetSnapshot: snapshots.ruleset,
  crossplaySnapshot: snapshots.crossplay,
  participants: context.participants.map((participant, index) => ({
    id: `participant-${String(index)}`,
    matchId: 'match',
    userId: participant.userId,
    userGameAccountId: participant.userGameAccountId,
    gameId: 'game',
    gamePlatformId: participant.gamePlatformId,
    side: index === 0 ? 'SIDE_A' : 'SIDE_B',
    status: 'PENDING',
    snapshot: snapshots.participants[index]!,
    readyAt: null,
  })),
  readyDeadlineAt: new Date('2026-07-26T12:02:00Z'),
  cancelledAt: null,
  voidedAt: null,
  startedAt: null,
  resultSubmissionDeadlineAt: null,
  resultConflictDeadlineAt: null,
  completedAt: null,
  version: 1,
  createdAt: now,
};
function repository(): MatchRepository {
  return {
    findByProposalId: vi.fn(async () => null),
    loadAcceptedProposalContext: vi.fn(async () => context),
    createMatch: vi.fn(async () => record),
    listForUser: vi.fn(async () => [record]),
    findForUser: vi.fn(async () => record),
    findById: vi.fn(async () => record),
    markReady: vi.fn(async () => ({
      ...record,
      participants: record.participants.map((participant) =>
        participant.userId === 'user-a'
          ? { ...participant, status: 'READY' as const, readyAt: now }
          : participant,
      ),
    })),
    cancel: vi.fn(async () => undefined),
    expireUnready: vi.fn(async () => 2),
    listAdmin: vi.fn(async () => [record]),
    listAudit: vi.fn(async () => []),
    voidMatch: vi.fn(async () => undefined),
    listAcceptedProposalIdsWithoutMatch: vi.fn(async () => ['proposal']),
  };
}
const transactions = (repo: MatchRepository): MatchTransactionManager => ({
  transaction: (operation) => operation(repo),
});
describe('match creation', () => {
  it('creates from accepted proposal with a ready deadline', async () => {
    const repo = repository();
    await expect(
      new MatchCreationService(repo, transactions(repo), clock).createMatchFromAcceptedProposal(
        'proposal',
      ),
    ).resolves.toBe(record);
    expect(repo.createMatch).toHaveBeenCalledWith({
      context,
      readyDeadlineAt: new Date('2026-07-26T12:02:00Z'),
    });
  });
  it('returns existing match idempotently', async () => {
    const repo = repository();
    vi.mocked(repo.findByProposalId).mockResolvedValue(record);
    await expect(
      new MatchCreationService(repo, transactions(repo), clock).createMatchFromAcceptedProposal(
        'proposal',
      ),
    ).resolves.toBe(record);
    expect(repo.createMatch).not.toHaveBeenCalled();
  });
  it('rejects non-accepted proposal and supports bounded recovery', async () => {
    const repo = repository();
    vi.mocked(repo.loadAcceptedProposalContext).mockResolvedValue({
      ...context,
      proposalStatus: 'OTHER',
    });
    const service = new MatchCreationService(repo, transactions(repo), clock);
    await expect(service.createMatchFromAcceptedProposal('proposal')).rejects.toMatchObject({
      code: 'MATCH_PROPOSAL_INVALID',
    });
    vi.mocked(repo.loadAcceptedProposalContext).mockResolvedValue(context);
    await expect(service.createMissingMatchesForAcceptedProposals(999)).resolves.toBe(1);
    expect(repo.listAcceptedProposalIdsWithoutMatch).toHaveBeenCalledWith(100);
  });
  it('recovers the race winner after a unique conflict', async () => {
    const repo = repository();
    vi.mocked(repo.createMatch).mockRejectedValue(new MatchError('MATCH_CREATION_CONFLICT'));
    vi.mocked(repo.findByProposalId).mockResolvedValueOnce(null).mockResolvedValue(record);
    await expect(
      new MatchCreationService(repo, transactions(repo), clock).createMatchFromAcceptedProposal(
        'proposal',
      ),
    ).resolves.toBe(record);
  });
});
describe('match service', () => {
  it('checks participant entry before marking ready', async () => {
    const repo = repository();
    const eligibility: MatchEntryEligibilityPort = {
      assertParticipantEntrySatisfied: vi.fn(async () => undefined),
      assertMatchEntrySatisfied: vi.fn(async () => undefined),
      releaseMatchEntries: vi.fn(async () => undefined),
    };
    await new MatchService(repo, clock, eligibility).ready('user-a', 'match');
    expect(eligibility.assertParticipantEntrySatisfied).toHaveBeenCalledWith(
      'match',
      'participant-0',
    );
    vi.mocked(eligibility.assertParticipantEntrySatisfied).mockRejectedValue(
      new Error('entry missing'),
    );
    await expect(
      new MatchService(repo, clock, eligibility).ready('user-a', 'match'),
    ).rejects.toThrow('entry missing');
  });
  it('returns safe participant projections', async () => {
    const view = await new MatchService(repository(), clock).getMine('user-a', 'match');
    expect(view.participants[1]).not.toHaveProperty('userId');
    expect(view.participants[1]).not.toHaveProperty('userGameAccountId');
    expect(view.participants[0]).toMatchObject({ isCurrentUser: true });
  });
  it('marks ready, handles repeat idempotently and rejects deadline', async () => {
    const repo = repository();
    await new MatchService(repo, clock).ready('user-a', 'match');
    expect(repo.markReady).toHaveBeenCalledOnce();
    vi.mocked(repo.findForUser).mockResolvedValue({
      ...record,
      participants: [
        { ...record.participants[0]!, status: 'READY', readyAt: now },
        record.participants[1]!,
      ],
    });
    await new MatchService(repo, clock).ready('user-a', 'match');
    expect(repo.markReady).toHaveBeenCalledOnce();
    vi.mocked(repo.findForUser).mockResolvedValue({
      ...record,
      readyDeadlineAt: new Date('2026-07-26T11:59:00Z'),
    });
    await expect(new MatchService(repo, clock).ready('user-a', 'match')).rejects.toMatchObject({
      code: 'MATCH_READY_DEADLINE_EXPIRED',
    });
  });
  it('allows cancel before ready, rejects after ready, and bounds expiration', async () => {
    const repo = repository();
    const service = new MatchService(repo, clock);
    await service.cancel('user-a', 'match');
    expect(repo.cancel).toHaveBeenCalled();
    vi.mocked(repo.findForUser).mockResolvedValue({ ...record, status: 'READY' });
    await expect(service.cancel('user-a', 'match')).rejects.toMatchObject({
      code: 'MATCH_STATE_TRANSITION_INVALID',
    });
    await expect(service.expireUnreadyMatches(9999)).resolves.toBe(2);
    expect(repo.expireUnready).toHaveBeenCalledWith(now, 500);
  });
});
describe('admin match service', () => {
  it('voids with audit metadata and is idempotent once voided', async () => {
    const repo = repository();
    const service = new AdminMatchService(repo, clock);
    await service.void('admin', 'match', 'OPERATIONAL_ERROR');
    expect(repo.voidMatch).toHaveBeenCalledWith(
      'admin',
      'match',
      'OPERATIONAL_ERROR',
      undefined,
      now,
    );
    vi.mocked(repo.findById).mockResolvedValue({ ...record, status: 'VOIDED' });
    await service.void('admin', 'match', 'OPERATIONAL_ERROR');
    expect(repo.voidMatch).toHaveBeenCalledOnce();
  });
});
