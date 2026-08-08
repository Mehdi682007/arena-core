import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { MatchFinanceError } from '@arena-core/match-finance';
import { createApiApplication } from '../dist/bootstrap.js';

const userId = '00000000-0000-4000-8000-000000000201';
const matchId = '00000000-0000-4000-8000-000000000202';
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '5.2.0', actualNodeVersion: process.versions.node },
);
const identityServices = {
  identity: {},
  sessions: {
    validateSession: vi.fn(async () => ({
      valid: true,
      userId,
      sessionId: 'session-1',
      mfaVerifiedAt: new Date('2026-08-08T00:00:00Z'),
    })),
  },
  emailVerification: {},
  passwordReset: {},
};
const view = {
  matchId,
  status: 'RESERVED',
  asset: { code: 'ARENA_POINT', monetary: false, withdrawable: false },
  amount: '100',
  reservedAt: new Date('2026-07-27T00:00:00Z'),
  releasedAt: null,
  refundedAt: null,
};
let application;
let baseUrl;
let reservationService;
let adminService;
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
  reservationService = {
    reserve: vi.fn(async () => view),
    getMine: vi.fn(async () => view),
    listMine: vi.fn(async () => [view]),
  };
  adminService = {
    listMatch: vi.fn(async () => [view]),
    refund: vi.fn(async () => [{ ...view, status: 'REFUNDED' }]),
    release: vi.fn(async () => [{ ...view, status: 'RELEASED' }]),
    reconcile: vi.fn(async () => ({
      consistent: true,
      escrowBalance: 100n,
      expectedBalance: 100n,
      difference: 0n,
      reservationCount: 1,
    })),
  };
  authorization = { hasPermission: vi.fn(async () => true) };
  await start({
    reservationService,
    adminService,
    authorization,
    eligibility: {
      assertParticipantEntrySatisfied: vi.fn(async () => undefined),
      assertMatchEntrySatisfied: vi.fn(async () => undefined),
      releaseMatchEntries: vi.fn(async () => undefined),
    },
  });
});

afterEach(async () => {
  await application?.close();
  application = undefined;
});

describe('match finance HTTP integration', () => {
  it('requires authentication and exposes only the safe current-user projection', async () => {
    expect((await request(`/matches/${matchId}/entry-reservation`, { auth: false })).status).toBe(
      401,
    );
    const response = await request(`/matches/${matchId}/entry-reservation`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    expect(text).not.toMatch(/walletId|ledgerAccount|transactionId|fingerprint|systemKey/);
  });
  it('reserves with strict DTO and server-owned amount/asset', async () => {
    const response = await request(`/matches/${matchId}/entry-reservation`, {
      method: 'POST',
      body: { idempotencyKey: 'match-reserve-001' },
    });
    expect(response.status).toBe(201);
    expect(reservationService.reserve).toHaveBeenCalledWith({
      matchId,
      userId,
      idempotencyKey: 'match-reserve-001',
    });
    expect(
      (
        await request(`/matches/${matchId}/entry-reservation`, {
          method: 'POST',
          body: { idempotencyKey: 'match-reserve-002', amount: '999' },
        })
      ).status,
    ).toBe(400);
  });
  it('lists only current-user reservations', async () => {
    const response = await request('/match-entry-reservations?limit=10');
    expect(response.status).toBe(200);
    expect(reservationService.listMine).toHaveBeenCalledWith(userId, 10);
  });
  it('enforces admin permission and supports safe reconciliation', async () => {
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect(
      (await request(`/admin/match-finance/matches/${matchId}/reservations?limit=10`)).status,
    ).toBe(403);
    const response = await request(`/admin/match-finance/matches/${matchId}/reconcile`, {
      method: 'POST',
      body: {},
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      consistent: true,
      escrowBalance: '100',
      difference: '0',
    });
  });
  it('enforces CSRF and strict refund input', async () => {
    expect(
      (
        await request(`/admin/match-finance/matches/${matchId}/refund`, {
          method: 'POST',
          origin: 'http://evil.invalid',
          body: { reasonCode: 'MATCH_CANCELLED', idempotencyKey: 'refund-match-001' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(`/admin/match-finance/matches/${matchId}/refund`, {
          method: 'POST',
          body: {
            reasonCode: 'MATCH_CANCELLED',
            idempotencyKey: 'refund-match-001',
            amount: '1',
          },
        })
      ).status,
    ).toBe(400);
  });
  it('returns a redacted 503 when persistence is disabled', async () => {
    reservationService.getMine.mockRejectedValue(
      new MatchFinanceError('MATCH_FINANCE_SERVICE_UNAVAILABLE'),
    );
    const response = await request(`/matches/${matchId}/entry-reservation`);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain('MATCH_FINANCE_SERVICE_UNAVAILABLE');
    expect(text).not.toMatch(/postgres|database|prisma|connection/i);
  });
  it('fails closed with the real database-disabled provider', async () => {
    await application.close();
    application = undefined;
    await start({
      eligibility: {
        assertParticipantEntrySatisfied: vi.fn(async () => undefined),
        assertMatchEntrySatisfied: vi.fn(async () => undefined),
        releaseMatchEntries: vi.fn(async () => undefined),
      },
    });

    const response = await request(`/matches/${matchId}/entry-reservation`);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    expect(text).toContain('MATCH_FINANCE_SERVICE_UNAVAILABLE');
    expect(text).not.toMatch(/postgres|database|prisma|connection/i);
  });
});
