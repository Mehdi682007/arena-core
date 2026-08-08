import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { createApiApplication } from '../dist/bootstrap.js';

const userId = '00000000-0000-4000-8000-000000000601';
const matchId = '00000000-0000-4000-8000-000000000602';
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '6.1.0', actualNodeVersion: process.versions.node },
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
let application;
let baseUrl;
let ratings;
let leaderboard;
let admin;
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
    {},
    overrides,
  );
  await application.listen(0, '127.0.0.1');
  const address = application.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
}

beforeEach(async () => {
  ratings = {
    getMyRatings: vi.fn(async () => [{ rating: 1020, matchesPlayed: 1 }]),
    getMyRating: vi.fn(async () => ({ rating: 1020, matchesPlayed: 1 })),
    getMyHistory: vi.fn(async () => ({
      items: [{ matchId, outcome: 'WIN', ratingBefore: 1000, ratingAfter: 1020, ratingDelta: 20 }],
      nextCursor: null,
    })),
  };
  leaderboard = {
    list: vi.fn(async () => ({
      items: [
        {
          rank: 1,
          player: { displayName: 'Player', gameHandle: 'ArenaPlayer' },
          rating: 1020,
          matchesPlayed: 1,
          wins: 1,
          losses: 0,
          draws: 0,
        },
      ],
      nextCursor: null,
    })),
    myRank: vi.fn(async () => ({ rank: 1 })),
  };
  admin = {
    list: vi.fn(async () => []),
    listUser: vi.fn(async () => []),
    match: vi.fn(async () => ({ matchId })),
    apply: vi.fn(async () => ({ matchId, status: 'APPLIED' })),
    recoverEligible: vi.fn(async () => []),
  };
  reconciliation = { reconcile: vi.fn(async () => ({ consistent: true })) };
  authorization = { hasPermission: vi.fn(async () => true) };
  await start({
    ratingService: ratings,
    leaderboardService: leaderboard,
    adminService: admin,
    reconciliationService: reconciliation,
    authorization,
  });
});

afterEach(async () => {
  await application?.close();
  application = undefined;
});

describe('rating HTTP integration', () => {
  it('protects private ratings, applies no-store and never exposes opponents', async () => {
    expect((await request('/ratings', { auth: false })).status).toBe(401);
    const response = await request('/ratings/fc-26/one-v-one/history?limit=10');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toMatch(/opponentUserId|calculationSnapshot|idempotencyKey/);
  });

  it('serves a public safe leaderboard with short cache', async () => {
    const response = await request('/leaderboards/fc-26/one-v-one?limit=10', { auth: false });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=30');
    expect(await response.text()).not.toMatch(/userId|email|wallet|normalizedHandle/);
  });

  it('enforces admin permission, strict DTO and CSRF', async () => {
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect((await request('/admin/ratings?limit=10')).status).toBe(403);
    expect(
      (
        await request(`/admin/ratings/matches/${matchId}/apply`, {
          method: 'POST',
          body: { idempotencyKey: 'rating-match-001', winner: userId },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`/admin/ratings/matches/${matchId}/apply`, {
          method: 'POST',
          origin: 'http://evil.invalid',
          body: { idempotencyKey: 'rating-match-002' },
        })
      ).status,
    ).toBe(403);
  });

  it('fails closed when database persistence is disabled', async () => {
    await application.close();
    application = undefined;
    await start({ authorization });
    const publicResponse = await request('/leaderboards/fc-26/one-v-one', { auth: false });
    expect(publicResponse.status).toBe(503);
    expect(await publicResponse.text()).toContain('RATING_SERVICE_UNAVAILABLE');
    const privateResponse = await request('/ratings');
    expect(privateResponse.status).toBe(503);
  });
});
