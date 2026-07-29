import { describe, expect, it, vi } from 'vitest';
import {
  AdminMatchDisputeService,
  buildSnapshots,
  MatchDisputeError,
  MatchDisputeService,
  MatchEvidenceService,
  type MatchDisputeRecord,
  type MatchDisputeRepository,
} from '../src';
import { context as proposal } from './fixtures';

const now = new Date('2026-07-26T12:00:00.000Z');
const clock = { now: () => now };
const snapshots = buildSnapshots(proposal);
const match = {
  id: 'match',
  status: 'COMPLETED',
  startedAt: new Date('2026-07-26T10:00:00Z'),
  completedAt: new Date('2026-07-26T11:30:00Z'),
  resultConflictDeadlineAt: null,
  rulesetSnapshot: snapshots.ruleset,
  participants: [
    { id: 'pa', userId: 'user-a', side: 'SIDE_A', snapshot: snapshots.participants[0] },
    { id: 'pb', userId: 'user-b', side: 'SIDE_B', snapshot: snapshots.participants[1] },
  ],
};
const dispute = (overrides: Partial<MatchDisputeRecord> = {}): MatchDisputeRecord =>
  ({
    id: 'dispute',
    matchId: 'match',
    openedByParticipantId: 'pa',
    openedByUserId: 'user-a',
    status: 'AWAITING_RESPONSE',
    reasonCode: 'SCORE_MISMATCH',
    claimPayload: {
      schemaVersion: 1,
      statement: 'The score is incorrect.',
      requestedOutcome: 'KEEP_CURRENT_RESULT',
      evidenceIds: [],
    },
    resultSnapshot: {
      schemaVersion: 1,
      matchStatus: 'COMPLETED',
      resultStatus: null,
      resultPayload: null,
      confirmationMethod: null,
      confirmedAt: null,
      submissions: [],
    },
    responseDeadlineAt: new Date('2026-07-27T12:00:00Z'),
    reviewDeadlineAt: new Date('2026-07-28T12:00:00Z'),
    assignedReviewerUserId: null,
    assignedAt: null,
    resolvedAt: null,
    resolutionType: null,
    version: 1,
    createdAt: now,
    response: null,
    ...overrides,
  }) as MatchDisputeRecord;
const baseContext = {
  resultContext: {
    match,
    submissions: [],
    result: null,
    completedAt: new Date('2026-07-26T11:30:00Z'),
    resultConflictDeadlineAt: null,
  },
  evidence: [],
  disputes: [],
};
const repository = (): MatchDisputeRepository =>
  ({
    loadForUser: vi.fn(async () => baseContext as never),
    createEvidence: vi.fn(async ({ userId, matchId, payload }) => ({
      id: 'evidence',
      matchId,
      participantId: userId === 'user-a' ? 'pa' : 'pb',
      submittedByUserId: userId,
      type: 'TEXT_STATEMENT',
      status: 'ACTIVE',
      payload,
      capturedAt: null,
      submittedAt: now,
      withdrawnAt: null,
      version: 1,
    })),
    withdrawEvidence: vi.fn(async () => undefined),
    createDispute: vi.fn(async () => dispute()),
    respond: vi.fn(async () =>
      dispute({
        status: 'UNDER_REVIEW',
        response: {
          id: 'response',
          disputeId: 'dispute',
          participantId: 'pb',
          submittedByUserId: 'user-b',
          statement: 'I disagree.',
          evidenceIds: [],
          submittedAt: now,
        },
      }),
    ),
    cancel: vi.fn(async () => undefined),
    listAdmin: vi.fn(async () => [dispute()]),
    findAdmin: vi.fn(async () => baseContext),
    assignSelf: vi.fn(async () => dispute({ assignedReviewerUserId: 'admin', assignedAt: now })),
    startReview: vi.fn(async () =>
      dispute({ status: 'UNDER_REVIEW', assignedReviewerUserId: 'admin', assignedAt: now }),
    ),
    resolve: vi.fn(async () =>
      dispute({
        status: 'RESOLVED',
        assignedReviewerUserId: 'admin',
        resolutionType: 'UPHOLD_RESULT',
        resolvedAt: now,
      }),
    ),
    expireResponses: vi.fn(async () => 2),
  }) as unknown as MatchDisputeRepository;

describe('F4.4 evidence and dispute application services', () => {
  it('derives evidence ownership and delegates metadata persistence', async () => {
    const repo = repository();
    const service = new MatchEvidenceService(repo, clock, 86_400);
    expect(
      await service.submit('user-a', 'match', {
        schemaVersion: 1,
        type: 'TEXT_STATEMENT',
        description: 'Score statement',
      }),
    ).toMatchObject({ id: 'evidence', status: 'ACTIVE' });
    expect(repo.createEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', matchId: 'match' }),
    );
  });

  it('opens with a result snapshot and one bounded active workflow', async () => {
    const repo = repository();
    const service = new MatchDisputeService(repo, clock, 86_400, 86_400, 259_200);
    await service.open('user-a', 'match', 'SCORE_MISMATCH', {
      schemaVersion: 1,
      statement: 'The final score is incorrect.',
      requestedOutcome: 'KEEP_CURRENT_RESULT',
      evidenceIds: [],
    });
    expect(repo.createDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-a',
        snapshot: expect.objectContaining({ schemaVersion: 1, matchStatus: 'COMPLETED' }),
      }),
    );
  });

  it('allows only the opponent to append a response and moves to review', async () => {
    const repo = repository();
    vi.mocked(repo.loadForUser).mockResolvedValue({
      ...baseContext,
      disputes: [dispute()],
    } as never);
    const service = new MatchDisputeService(repo, clock, 86_400, 86_400, 259_200);
    await expect(service.respond('user-a', 'match', 'dispute', 'self', [])).rejects.toBeInstanceOf(
      MatchDisputeError,
    );
    await expect(
      service.respond('user-b', 'match', 'dispute', 'I disagree.', []),
    ).resolves.toMatchObject({ status: 'UNDER_REVIEW', hasResponse: true });
  });

  it('delegates assignment and bounded expiration, and rejects unassigned resolution', async () => {
    const repo = repository();
    const service = new AdminMatchDisputeService(repo, clock);
    await expect(service.assignSelf('dispute', 'admin')).resolves.toMatchObject({
      assignedReviewerUserId: 'admin',
    });
    await expect(service.expire(2)).resolves.toBe(2);
    await expect(
      service.resolve('dispute', 'admin', 'UPHOLD_RESULT', undefined, 'REVIEWED'),
    ).rejects.toBeInstanceOf(MatchDisputeError);
  });
});
