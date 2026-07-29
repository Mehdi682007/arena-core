import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { MatchmakingError } from '@arena-core/matchmaking';
import { createApiApplication } from '../dist/bootstrap.js';

const requestId = '00000000-0000-4000-8000-000000000101';
const proposalId = '00000000-0000-4000-8000-000000000102';
const accountId = '00000000-0000-4000-8000-000000000103';
const modeId = '00000000-0000-4000-8000-000000000104';
const rulesetId = '00000000-0000-4000-8000-000000000105';
let application, baseUrl, requestService, proposalService, adminRepository, authorization;
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '4.1.0', actualNodeVersion: process.versions.node },
);
const identityServices = {
  identity: {},
  sessions: {
    validateSession: vi.fn(async () => ({ valid: true, userId: 'user-1', sessionId: 'session-1' })),
  },
  emailVerification: {},
  passwordReset: {},
};
const requestView = {
  id: requestId,
  status: 'SEARCHING',
  searchScope: 'CROSSPLAY_GROUP',
  expiresAt: new Date(),
  createdAt: new Date(),
};
const proposalView = {
  id: proposalId,
  status: 'PENDING',
  expiresAt: new Date(),
  gameId: 'game',
  gameModeId: modeId,
  gameRulesetId: rulesetId,
  crossplayGroupId: 'group',
  myAcceptance: false,
  opponentAcceptance: false,
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
  requestService = {
    listMyRequests: vi.fn(async () => [requestView]),
    getMyRequest: vi.fn(async () => requestView),
    createRequest: vi.fn(async () => requestView),
    cancelMyRequest: vi.fn(async () => undefined),
  };
  proposalService = {
    currentProposal: vi.fn(async () => proposalView),
    accept: vi.fn(async () => ({ ...proposalView, myAcceptance: true })),
    reject: vi.fn(async () => undefined),
  };
  adminRepository = {
    listAdminRequests: vi.fn(async () => []),
    listAdminProposals: vi.fn(async () => []),
  };
  authorization = { hasPermission: vi.fn(async () => true) };
  application = await createApiApplication(
    config,
    false,
    { services: identityServices },
    {},
    {},
    {},
    { requestService, proposalService, adminRepository, authorization },
  );
  await application.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
});
afterEach(async () => application?.close());
describe('private matchmaking HTTP', () => {
  it('requires session and applies no-store', async () => {
    expect((await request('/matchmaking/requests', { auth: false })).status).toBe(401);
    const response = await request('/matchmaking/requests');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('creates from only account/mode/ruleset and strict preferences', async () => {
    const response = await request('/matchmaking/requests', {
      method: 'POST',
      body: {
        userGameAccountId: accountId,
        gameModeId: modeId,
        gameRulesetId: rulesetId,
        criteria: { language: 'fa', region: 'middle-east' },
      },
    });
    expect(response.status).toBe(201);
    expect(requestService.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', userGameAccountId: accountId }),
    );
    expect(
      (
        await request('/matchmaking/requests', {
          method: 'POST',
          body: {
            userGameAccountId: accountId,
            gameModeId: modeId,
            gameRulesetId: rulesetId,
            priority: 100,
          },
        })
      ).status,
    ).toBe(400);
  });
  it('supports cancel, accept and reject with CSRF-protected empty bodies', async () => {
    expect(
      (await request(`/matchmaking/requests/${requestId}/cancel`, { method: 'POST', body: {} }))
        .status,
    ).toBe(204);
    expect(
      (await request(`/matchmaking/proposals/${proposalId}/accept`, { method: 'POST', body: {} }))
        .status,
    ).toBe(201);
    expect(
      (await request(`/matchmaking/proposals/${proposalId}/reject`, { method: 'POST', body: {} }))
        .status,
    ).toBe(204);
  });
  it('never exposes opponent identity or internal criteria', async () => {
    const response = await request('/matchmaking/proposals/current');
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /opponentUser|opponentHandle|userBId|requestBId|criteria|score/,
    );
  });
  it('protects read-only admin inventory with permission', async () => {
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect((await request('/admin/matchmaking/requests')).status).toBe(403);
    expect((await request('/admin/matchmaking/proposals')).status).toBe(200);
  });
  it('maps DB-disabled/unavailable behavior safely', async () => {
    requestService.listMyRequests.mockRejectedValueOnce(
      new MatchmakingError('MATCHMAKING_UNAVAILABLE'),
    );
    const response = await request('/matchmaking/requests');
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'MATCHMAKING_UNAVAILABLE' },
    });
  });
  it('keeps routes registered with the real DB-disabled provider', async () => {
    await application.close();
    application = await createApiApplication(config, false, { services: identityServices });
    await application.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
    const response = await request('/matchmaking/requests');
    expect(response.status).toBe(503);
  });
  it('rate limits repeated create requests by authenticated principal', async () => {
    const body = { userGameAccountId: accountId, gameModeId: modeId, gameRulesetId: rulesetId };
    for (let index = 0; index < 10; index += 1)
      expect((await request('/matchmaking/requests', { method: 'POST', body })).status).toBe(201);
    expect((await request('/matchmaking/requests', { method: 'POST', body })).status).toBe(429);
  });
});
