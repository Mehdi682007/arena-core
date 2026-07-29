import { describe, expect, it, vi } from 'vitest';
import {
  AdminMatchResultService,
  buildSnapshots,
  MatchResultError,
  MatchResultService,
  MatchStartService,
  type Clock,
  type MatchRecord,
  type MatchResultContext,
  type MatchResultRepository,
  type MatchEntryEligibilityPort,
} from '../src';
import { context as proposal } from './fixtures';

const now = new Date('2026-07-26T18:00:00Z');
const clock: Clock = { now: () => now };
const snapshots = buildSnapshots({
  ...proposal,
  ruleset: { ...proposal.ruleset, configuration: { settings: { drawAllowed: true } } },
});
const match: MatchRecord = {
  id: 'match',
  matchmakingProposalId: 'proposal',
  gameId: 'game',
  gameModeId: 'mode',
  gameRulesetId: 'ruleset',
  crossplayGroupId: 'group',
  status: 'READY',
  gameSnapshot: snapshots.game,
  modeSnapshot: snapshots.mode,
  rulesetSnapshot: snapshots.ruleset,
  crossplaySnapshot: snapshots.crossplay,
  participants: proposal.participants.map((item, index) => ({
    id: index ? 'pb' : 'pa',
    matchId: 'match',
    userId: item.userId,
    userGameAccountId: item.userGameAccountId,
    gameId: 'game',
    gamePlatformId: item.gamePlatformId,
    side: index ? 'SIDE_B' : 'SIDE_A',
    status: 'READY',
    snapshot: snapshots.participants[index]!,
    readyAt: now,
  })),
  readyDeadlineAt: now,
  cancelledAt: null,
  voidedAt: null,
  startedAt: null,
  resultSubmissionDeadlineAt: null,
  resultConflictDeadlineAt: null,
  completedAt: null,
  version: 2,
  createdAt: now,
};
const base: MatchResultContext = {
  match,
  submissions: [],
  result: null,
  startedAt: null,
  resultSubmissionDeadlineAt: null,
  resultConflictDeadlineAt: null,
  completedAt: null,
};
function repository(overrides: Partial<MatchResultRepository> = {}): MatchResultRepository {
  return {
    findForUser: vi.fn(async () => base),
    findForAdmin: vi.fn(async () => base),
    start: vi.fn(async (_user, _match, startedAt, deadline) => ({
      ...base,
      match: {
        ...match,
        status: 'IN_PROGRESS' as const,
        startedAt,
        resultSubmissionDeadlineAt: deadline,
      },
      startedAt,
      resultSubmissionDeadlineAt: deadline,
    })),
    submit: vi.fn(async () => base),
    withdraw: vi.fn(async () => undefined),
    expire: vi.fn(async () => 0),
    listConflicts: vi.fn(async () => []),
    resolve: vi.fn(async () => base),
    ...overrides,
  };
}
const score = {
  schemaVersion: 1,
  type: 'SCORE',
  scores: [
    { side: 'SIDE_A', score: 2 },
    { side: 'SIDE_B', score: 1 },
  ],
};

describe('match start service', () => {
  it('starts READY match and derives deadline', async () => {
    const repo = repository();
    const result = await new MatchStartService(repo, clock, 3600).start('match', 'user-a');
    expect(result.match.status).toBe('IN_PROGRESS');
    expect(repo.start).toHaveBeenCalledWith(
      'user-a',
      'match',
      now,
      new Date('2026-07-26T19:00:00Z'),
    );
  });
  it('checks both entries and releases only after a successful start', async () => {
    const repo = repository();
    const eligibility: MatchEntryEligibilityPort = {
      assertParticipantEntrySatisfied: vi.fn(async () => undefined),
      assertMatchEntrySatisfied: vi.fn(async () => undefined),
      releaseMatchEntries: vi.fn(async () => undefined),
    };
    await new MatchStartService(repo, clock, 3600, eligibility).start('match', 'user-a');
    expect(eligibility.assertMatchEntrySatisfied).toHaveBeenCalledWith('match');
    expect(eligibility.releaseMatchEntries).toHaveBeenCalledWith('match');
    expect(vi.mocked(repo.start).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(eligibility.releaseMatchEntries).mock.invocationCallOrder[0]!,
    );
  });
  it('is idempotent after start', async () => {
    const started = { ...base, match: { ...match, status: 'IN_PROGRESS' as const } };
    const repo = repository({ findForUser: vi.fn(async () => started) });
    expect(await new MatchStartService(repo, clock, 3600).start('match', 'user-a')).toBe(started);
    expect(repo.start).not.toHaveBeenCalled();
  });
  it('rejects non-ready and missing ownership', async () => {
    const invalid = { ...base, match: { ...match, status: 'CANCELLED' as const } };
    await expect(
      new MatchStartService(
        repository({ findForUser: vi.fn(async () => invalid) }),
        clock,
        3600,
      ).start('match', 'user-a'),
    ).rejects.toMatchObject({ code: 'MATCH_START_INVALID' });
    await expect(
      new MatchStartService(
        repository({ findForUser: vi.fn(async () => null) }),
        clock,
        3600,
      ).start('match', 'stranger'),
    ).rejects.toBeInstanceOf(MatchResultError);
  });
});

describe('match result service', () => {
  const active = {
    ...base,
    match: { ...match, status: 'IN_PROGRESS' as const },
    resultSubmissionDeadlineAt: new Date('2026-07-26T19:00:00Z'),
  };
  it('validates and submits canonical result', async () => {
    const repo = repository({
      findForUser: vi.fn(async () => active),
      submit: vi.fn(async (_user, _id, payload) => ({
        ...active,
        submissions: [
          {
            id: 's1',
            matchId: 'match',
            participantId: 'pa',
            submittedByUserId: 'user-a',
            status: 'ACTIVE' as const,
            resultPayload: payload,
            submittedAt: now,
            withdrawnAt: null,
            supersededAt: null,
            version: 1,
          },
        ],
      })),
    });
    const view = await new MatchResultService(repo, clock, 86400).submit('match', 'user-a', score);
    expect(view.submission.status).toBe('SUBMITTED');
  });
  it('rejects expired and finalized submissions', async () => {
    const expired = { ...active, resultSubmissionDeadlineAt: now };
    await expect(
      new MatchResultService(
        repository({ findForUser: vi.fn(async () => expired) }),
        clock,
        1,
      ).submit('match', 'user-a', score),
    ).rejects.toMatchObject({ code: 'MATCH_RESULT_SUBMISSION_DEADLINE_EXPIRED' });
    const finalized = {
      ...active,
      result: {
        id: 'result',
        matchId: 'match',
        status: 'CONFIRMED' as const,
        resultPayload: score as never,
        winnerParticipantId: 'pa',
        loserParticipantId: 'pb',
        isDraw: false,
        confirmationMethod: 'PARTICIPANT_AGREEMENT' as const,
        conflictReason: null,
        confirmedAt: now,
        resolvedByUserId: null,
        resolutionReasonCode: null,
      },
    };
    await expect(
      new MatchResultService(
        repository({ findForUser: vi.fn(async () => finalized) }),
        clock,
        1,
      ).submit('match', 'user-a', score),
    ).rejects.toMatchObject({ code: 'MATCH_RESULT_ALREADY_FINALIZED' });
  });
  it('withdraws only without opponent submission', async () => {
    const repo = repository({ findForUser: vi.fn(async () => active) });
    await new MatchResultService(repo, clock, 1).withdraw('match', 'user-a');
    expect(repo.withdraw).toHaveBeenCalled();
  });
  it('bounds expiration batch', async () => {
    const repo = repository();
    await new MatchResultService(repo, clock, 60).expire(9999);
    expect(repo.expire).toHaveBeenCalledWith(now, 500, new Date(now.getTime() + 60_000));
  });
});

describe('admin result service', () => {
  it('requires conflict and validates OTHER note', async () => {
    const conflict = { ...base, match: { ...match, status: 'RESULT_CONFLICT' as const } };
    const service = new AdminMatchResultService(
      repository({ findForAdmin: vi.fn(async () => conflict) }),
      clock,
    );
    await expect(service.resolve('admin', 'match', score, 'OTHER')).rejects.toMatchObject({
      code: 'MATCH_RESULT_RESOLUTION_INVALID',
    });
    await service.resolve('admin', 'match', score, 'OTHER', 'manual correction');
  });
  it('selects an existing conflicting submission', async () => {
    const selected = {
      id: 'submission-a',
      matchId: 'match',
      participantId: 'pa',
      submittedByUserId: 'user-a',
      status: 'CONFLICTING' as const,
      resultPayload: {
        schemaVersion: 1 as const,
        type: 'SCORE' as const,
        scores: [
          { side: 'SIDE_A' as const, score: 2 },
          { side: 'SIDE_B' as const, score: 1 },
        ],
        outcome: 'WIN_LOSS' as const,
      },
      submittedAt: now,
      withdrawnAt: null,
      supersededAt: null,
      version: 1,
    };
    const conflict = {
      ...base,
      match: { ...match, status: 'RESULT_CONFLICT' as const },
      submissions: [selected],
    };
    const repo = repository({ findForAdmin: vi.fn(async () => conflict) });
    await new AdminMatchResultService(repo, clock).resolve(
      'admin',
      'match',
      { submissionId: selected.id },
      'SUBMISSION_ERROR',
    );
    expect(repo.resolve).toHaveBeenCalledWith(
      'admin',
      'match',
      selected.resultPayload,
      'SUBMISSION_ERROR',
      undefined,
      now,
    );
  });
});
