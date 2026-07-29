import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { createApiApplication } from '../dist/bootstrap.js';
const userId = '00000000-0000-4000-8000-000000000301';
const matchId = '00000000-0000-4000-8000-000000000302';
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '5.3.0', actualNodeVersion: process.versions.node },
);
const identityServices = {
  identity: {},
  sessions: {
    validateSession: vi.fn(async () => ({ valid: true, userId, sessionId: 'session-1' })),
  },
  emailVerification: {},
  passwordReset: {},
};
const view = {
  matchId,
  status: 'SETTLED',
  type: 'WINNER_TAKES_ALL',
  asset: { code: 'ARENA_POINT', monetary: false, withdrawable: false },
  totalAmount: '200',
  receivedAmount: '200',
  settledAt: new Date('2026-07-28T00:00:00Z'),
};
let application;
let baseUrl;
let settlementService;
let adminService;
let reconciliation;
let authorization;
function request(path, options = {}) {
  return globalThis.fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.auth === false
        ? {}
        : { cookie: 'arena_session=opaque-session-token-value-123456789' }),
      ...(options.method && options.method !== 'GET'
        ? { 'content-type': 'application/json', origin: options.origin ?? 'http://localhost:3000' }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}
async function start(overrides) {
  application = await createApiApplication(
    config,
    false,
    { services: identityServices },
    {},
    {},
    {},
    {},
    {},
    {},
    overrides,
  );
  await application.listen(0, '127.0.0.1');
  const address = application.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
}
beforeEach(async () => {
  settlementService = {
    getMine: vi.fn(async () => view),
    listMine: vi.fn(async () => [view]),
  };
  adminService = {
    list: vi.fn(async () => [view]),
    inspect: vi.fn(async () => view),
    settle: vi.fn(async () => view),
    retry: vi.fn(async () => view),
    listEligible: vi.fn(async () => [matchId]),
  };
  reconciliation = {
    reconcile: vi.fn(async () => ({
      consistent: true,
      escrowBalance: 0n,
      expectedBalance: 0n,
      difference: 0n,
      autoFixed: false,
    })),
  };
  authorization = { hasPermission: vi.fn(async () => true) };
  await start({
    settlementService,
    adminSettlementService: adminService,
    settlementReconciliationService: reconciliation,
    authorization,
    eligibility: {
      assertParticipantEntrySatisfied: vi.fn(),
      assertMatchEntrySatisfied: vi.fn(),
      releaseMatchEntries: vi.fn(),
    },
  });
});
afterEach(async () => {
  await application?.close();
  application = undefined;
});
describe('match settlement HTTP integration', () => {
  it('is private, no-store and returns only a safe user projection', async () => {
    expect((await request(`/matches/${matchId}/settlement`, { auth: false })).status).toBe(401);
    const response = await request(`/matches/${matchId}/settlement`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toMatch(/walletId|transactionId|fingerprint|opponent/);
  });
  it('lists current-user settlements with bounded pagination', async () => {
    expect((await request('/match-settlements?limit=10')).status).toBe(200);
    expect(settlementService.listMine).toHaveBeenCalledWith(userId, 10);
    expect((await request('/match-settlements?limit=1000')).status).toBe(400);
  });
  it('derives settlement inputs server-side and rejects extra fields', async () => {
    const response = await request(`/admin/match-settlements/${matchId}/settle`, {
      method: 'POST',
      body: { idempotencyKey: 'settle-match-001' },
    });
    expect(response.status).toBe(201);
    expect(adminService.settle).toHaveBeenCalledWith(matchId, 'settle-match-001', userId);
    expect(
      (
        await request(`/admin/match-settlements/${matchId}/settle`, {
          method: 'POST',
          body: { idempotencyKey: 'settle-match-002', winner: userId, amount: '999' },
        })
      ).status,
    ).toBe(400);
  });
  it('enforces permission, CSRF and reconciliation without auto-fix', async () => {
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect((await request('/admin/match-settlements?limit=10')).status).toBe(403);
    expect(
      (
        await request(`/admin/match-settlements/${matchId}/retry`, {
          method: 'POST',
          origin: 'http://evil.invalid',
          body: { idempotencyKey: 'retry-match-001' },
        })
      ).status,
    ).toBe(403);
    const response = await request(`/admin/match-settlements/${matchId}/reconcile`, {
      method: 'POST',
      body: {},
    });
    expect(await response.json()).toMatchObject({ consistent: true, autoFixed: false });
  });
  it('fails closed with the real database-disabled provider', async () => {
    await application.close();
    application = undefined;
    await start({
      authorization,
      eligibility: {
        assertParticipantEntrySatisfied: vi.fn(),
        assertMatchEntrySatisfied: vi.fn(),
        releaseMatchEntries: vi.fn(),
      },
    });
    const response = await request(`/matches/${matchId}/settlement`);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain('MATCH_SETTLEMENT_SERVICE_UNAVAILABLE');
    expect(text).not.toMatch(/postgres|prisma|database|connection/i);
  });
});
