import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { MatchError } from '@arena-core/matches';
import { createApiApplication } from '../dist/bootstrap.js';

const matchId = '00000000-0000-4000-8000-000000000201';
const proposalId = '00000000-0000-4000-8000-000000000202';
let application, baseUrl, matchService, adminService, creationService, authorization;
let startService, resultService, adminResultService;
let evidenceService, disputeService, adminDisputeService;
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '4.2.0', actualNodeVersion: process.versions.node },
);
const identityServices = {
  identity: {},
  sessions: {
    validateSession: vi.fn(async () => ({
      valid: true,
      userId: 'user-1',
      sessionId: 'session-1',
    })),
  },
  emailVerification: {},
  passwordReset: {},
};
const view = {
  id: matchId,
  status: 'AWAITING_READY',
  game: { gameId: 'game', key: 'FC26', slug: 'fc-26', name: 'FC 26' },
  mode: {
    gameModeId: 'mode',
    key: 'ONE_V_ONE',
    slug: '1v1',
    name: '1v1',
    teamSizeMin: 1,
    teamSizeMax: 1,
    participantCountMin: 2,
    participantCountMax: 2,
  },
  ruleset: { key: 'ARENA', name: 'Arena', version: 1, configuration: {} },
  crossplay: { key: 'CURRENT', name: 'Current Gen' },
  participants: [
    {
      side: 'SIDE_A',
      displayHandle: 'Me',
      platform: { key: 'PS5', name: 'PlayStation 5' },
      ready: false,
      isCurrentUser: true,
    },
    {
      side: 'SIDE_B',
      displayHandle: 'Opponent',
      platform: { key: 'XBOX', name: 'Xbox' },
      ready: false,
      isCurrentUser: false,
    },
  ],
  readyDeadlineAt: new Date(),
  createdAt: new Date(),
};
function request(path, options = {}) {
  return globalThis.fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.auth === false
        ? {}
        : { cookie: 'arena_session=opaque-session-token-value-123456789' }),
      ...(options.method && options.method !== 'GET'
        ? { 'content-type': 'application/json', origin: 'http://localhost:3000' }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}
beforeEach(async () => {
  matchService = {
    listMine: vi.fn(async () => [view]),
    getMine: vi.fn(async () => view),
    ready: vi.fn(async () => ({
      ...view,
      participants: [{ ...view.participants[0], ready: true }],
    })),
    cancel: vi.fn(async () => undefined),
  };
  adminService = {
    list: vi.fn(async () => []),
    detail: vi.fn(async () => ({
      match: {
        ...view,
        gameSnapshot: { data: view.game },
        modeSnapshot: { data: view.mode },
        rulesetSnapshot: { data: view.ruleset },
        crossplaySnapshot: { data: view.crossplay },
        participants: [],
        readyDeadlineAt: new Date(),
        createdAt: new Date(),
      },
      audit: [],
    })),
    void: vi.fn(async () => undefined),
  };
  creationService = {
    createMatchFromAcceptedProposal: vi.fn(async () => ({ id: matchId })),
    createMissingMatchesForAcceptedProposals: vi.fn(async () => 0),
  };
  startService = { start: vi.fn(async () => ({ match: { status: 'IN_PROGRESS' } })) };
  resultService = {
    submit: vi.fn(async () => ({ status: 'PENDING', submission: { submitted: true } })),
    withdraw: vi.fn(async () => undefined),
    get: vi.fn(async () => ({
      status: 'CONFLICT',
      submission: { submitted: true, submittedAt: new Date(), status: 'CONFLICT' },
    })),
  };
  adminResultService = {
    listConflicts: vi.fn(async () => []),
    detail: vi.fn(async () => ({
      match: { id: matchId, status: 'RESULT_CONFLICT', participants: [] },
      submissions: [],
      result: { status: 'CONFLICT' },
      resultConflictDeadlineAt: new Date(),
    })),
    resolve: vi.fn(async () => ({ match: { status: 'COMPLETED' } })),
  };
  evidenceService = {
    listMine: vi.fn(async () => []),
    submit: vi.fn(async () => ({ id: proposalId, type: 'TEXT_STATEMENT', status: 'ACTIVE' })),
    withdraw: vi.fn(async () => undefined),
  };
  disputeService = {
    listMine: vi.fn(async () => []),
    get: vi.fn(async () => ({ id: proposalId, status: 'AWAITING_RESPONSE' })),
    open: vi.fn(async () => ({ id: proposalId, status: 'AWAITING_RESPONSE' })),
    respond: vi.fn(async () => ({ id: proposalId, status: 'UNDER_REVIEW' })),
    cancel: vi.fn(async () => undefined),
  };
  adminDisputeService = {
    list: vi.fn(async () => []),
    detail: vi.fn(async () => ({
      disputes: [],
      evidence: [],
      resultContext: { match: { participants: [] } },
    })),
    assignSelf: vi.fn(async () => ({
      id: proposalId,
      matchId,
      status: 'AWAITING_RESPONSE',
      reasonCode: 'SCORE_MISMATCH',
      claimPayload: { requestedOutcome: 'KEEP_CURRENT_RESULT' },
      responseDeadlineAt: new Date(),
      reviewDeadlineAt: new Date(),
      assignedReviewerUserId: 'reviewer',
      response: null,
      resolutionType: null,
      createdAt: new Date(),
    })),
    startReview: vi.fn(),
    resolve: vi.fn(),
  };
  authorization = { hasPermission: vi.fn(async () => true) };
  application = await createApiApplication(
    config,
    false,
    { services: identityServices },
    {},
    {},
    {},
    {
      proposalService: {
        currentProposal: vi.fn(async () => null),
        accept: vi.fn(async () => ({ id: proposalId, status: 'ACCEPTED' })),
        reject: vi.fn(async () => undefined),
      },
    },
    {
      creationService,
      matchService,
      adminService,
      authorization,
      startService,
      resultService,
      adminResultService,
      evidenceService,
      disputeService,
      adminDisputeService,
    },
  );
  await application.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
});
afterEach(async () => application?.close());
describe('private match HTTP', () => {
  it('requires a session and applies no-store', async () => {
    expect((await request('/matches', { auth: false })).status).toBe(401);
    const response = await request('/matches');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('lists and reads only safe match projections', async () => {
    const response = await request(`/matches/${matchId}`);
    expect(response.status).toBe(200);
    const text = JSON.stringify(await response.json());
    expect(text).toContain('Opponent');
    expect(text).not.toMatch(/userId|userGameAccountId|normalizedHandle|email|proposalId/);
  });
  it('supports ready and cancel with strict CSRF-protected bodies', async () => {
    expect((await request(`/matches/${matchId}/ready`, { method: 'POST', body: {} })).status).toBe(
      201,
    );
    expect((await request(`/matches/${matchId}/cancel`, { method: 'POST', body: {} })).status).toBe(
      204,
    );
    expect(
      (await request(`/matches/${matchId}/ready`, { method: 'POST', body: { status: 'READY' } }))
        .status,
    ).toBe(400);
  });
  it('maps ready deadline and unavailable errors safely', async () => {
    matchService.ready.mockRejectedValueOnce(new MatchError('MATCH_READY_DEADLINE_EXPIRED'));
    expect((await request(`/matches/${matchId}/ready`, { method: 'POST', body: {} })).status).toBe(
      410,
    );
    matchService.listMine.mockRejectedValueOnce(new MatchError('MATCH_SERVICE_UNAVAILABLE'));
    expect((await request('/matches')).status).toBe(503);
  });
  it('creates a match when the second matchmaking acceptance becomes accepted', async () => {
    const response = await request(`/matchmaking/proposals/${proposalId}/accept`, {
      method: 'POST',
      body: {},
    });
    expect(response.status).toBe(201);
    expect(creationService.createMatchFromAcceptedProposal).toHaveBeenCalledWith(proposalId);
  });
  it('guards admin read/manage permissions and validates void reasons', async () => {
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect((await request('/admin/matches')).status).toBe(403);
    expect(
      (
        await request(`/admin/matches/${matchId}/void`, {
          method: 'POST',
          body: { reasonCode: 'OTHER' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`/admin/matches/${matchId}/void`, {
          method: 'POST',
          body: { reasonCode: 'OPERATIONAL_ERROR' },
        })
      ).status,
    ).toBe(204);
  });
  it('starts, submits, withdraws and hides opponent result details', async () => {
    expect((await request(`/matches/${matchId}/start`, { method: 'POST', body: {} })).status).toBe(
      201,
    );
    expect(
      (
        await request(`/matches/${matchId}/result-submissions`, {
          method: 'POST',
          body: {
            result: {
              schemaVersion: 1,
              type: 'SCORE',
              scores: [
                { side: 'SIDE_A', score: 2 },
                { side: 'SIDE_B', score: 1 },
              ],
            },
          },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(`/matches/${matchId}/result-submissions/withdraw`, {
          method: 'POST',
          body: {},
        })
      ).status,
    ).toBe(204);
    const response = await request(`/matches/${matchId}/result`);
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /opponent|submittedByUserId|participantId/i,
    );
  });
  it('strictly validates result bodies and guards admin result permissions', async () => {
    expect(
      (
        await request(`/matches/${matchId}/result-submissions`, {
          method: 'POST',
          body: { result: { winnerParticipantId: 'forged' } },
        })
      ).status,
    ).toBe(400);
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect((await request('/admin/match-results/conflicts')).status).toBe(403);
    expect(
      (
        await request(`/admin/match-results/${matchId}/resolve`, {
          method: 'POST',
          body: {
            result: {
              schemaVersion: 1,
              type: 'SCORE',
              scores: [
                { side: 'SIDE_A', score: 2 },
                { side: 'SIDE_B', score: 1 },
              ],
            },
            reasonCode: 'OTHER',
          },
        })
      ).status,
    ).toBe(400);
  });
  it('registers routes while database disabled and fails closed', async () => {
    await application.close();
    application = await createApiApplication(config, false, { services: identityServices });
    await application.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
    expect((await request('/matches')).status).toBe(503);
    expect((await request(`/matches/${matchId}/evidence`)).status).toBe(503);
    expect((await request(`/matches/${matchId}/disputes`)).status).toBe(503);
  });
  it('supports metadata-only evidence and rejects upload/storage fields', async () => {
    const valid = await request(`/matches/${matchId}/evidence`, {
      method: 'POST',
      body: {
        evidence: {
          schemaVersion: 1,
          type: 'TEXT_STATEMENT',
          description: 'Score declaration',
        },
      },
    });
    expect(valid.status).toBe(201);
    expect(evidenceService.submit).toHaveBeenCalled();
    for (const field of ['url', 'path', 'binary', 'storageKey']) {
      expect(
        (
          await request(`/matches/${matchId}/evidence`, {
            method: 'POST',
            body: {
              evidence: {
                schemaVersion: 1,
                type: 'TEXT_STATEMENT',
                [field]: 'forbidden',
              },
            },
          })
        ).status,
      ).toBe(400);
    }
  });
  it('opens/responds/cancels disputes and guards admin review', async () => {
    expect(
      (
        await request(`/matches/${matchId}/disputes`, {
          method: 'POST',
          body: {
            reasonCode: 'SCORE_MISMATCH',
            claim: {
              schemaVersion: 1,
              statement: 'The score differs from the declaration.',
              requestedOutcome: 'KEEP_CURRENT_RESULT',
              evidenceIds: [],
            },
          },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(`/matches/${matchId}/disputes/${proposalId}/respond`, {
          method: 'POST',
          body: { statement: 'I disagree.', evidenceIds: [] },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(`/matches/${matchId}/disputes/${proposalId}/cancel`, {
          method: 'POST',
          body: {},
        })
      ).status,
    ).toBe(204);
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect((await request('/admin/match-disputes')).status).toBe(403);
    expect(
      (
        await request(`/admin/match-disputes/${proposalId}/assign-self`, {
          method: 'POST',
          body: {},
        })
      ).status,
    ).toBe(201);
  });
});
