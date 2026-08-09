import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { PlayerIdentityError } from '@arena-core/player-identity';
import { createApiApplication } from '../dist/bootstrap.js';

const accountId = '00000000-0000-4000-8000-000000000010';
const gameId = '00000000-0000-4000-8000-000000000011';
const gamePlatformId = '00000000-0000-4000-8000-000000000012';
let application, baseUrl, playerService, adminService, authorization;
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '3.3.0', actualNodeVersion: process.versions.node },
);
const identityServices = {
  identity: {},
  sessions: {
    validateSession: vi.fn(async () => ({
      valid: true,
      userId: 'user-1',
      sessionId: 'session-1',
      mfaVerifiedAt: new Date('2026-08-08T00:00:00Z'),
    })),
  },
  emailVerification: {},
  passwordReset: {},
};
const view = {
  id: accountId,
  game: { id: gameId, key: 'fc26', slug: 'fc-26', name: 'FC 26' },
  platform: { id: 'p1', key: 'pc', slug: 'pc', name: 'PC' },
  displayHandle: 'Player',
  status: 'PENDING',
  isPrimary: false,
  verifiedAt: null,
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
  playerService = {
    listMyGameAccounts: vi.fn(async () => [view]),
    listClaimableGamePlatforms: vi.fn(async () => [
      {
        game: {
          id: gameId,
          key: 'fc26',
          slug: 'fc-26',
          name: 'FC 26',
        },
        platform: {
          id: 'p1',
          key: 'pc',
          slug: 'pc',
          name: 'PC',
        },
        gamePlatformId,
      },
    ]),
    getMyGameAccount: vi.fn(async () => view),
    createGameAccountClaim: vi.fn(async () => view),
    disconnectMyGameAccount: vi.fn(async () => undefined),
    setPrimaryGameAccount: vi.fn(async () => undefined),
    resubmitRejectedGameAccount: vi.fn(async () => view),
  };
  adminService = {
    listPendingGameAccounts: vi.fn(async () => ({
      items: [{ ...view, ownerDisplayName: 'Player' }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    })),
    getGameAccount: vi.fn(async () => view),
    review: vi.fn(async () => undefined),
    getGameAccountReviewHistory: vi.fn(async () => []),
  };
  authorization = { hasPermission: vi.fn(async () => true) };
  application = await createApiApplication(
    config,
    false,
    { services: identityServices },
    {},
    {},
    { playerService, adminService, authorization },
  );
  await application.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
});
afterEach(async () => application?.close());
describe('private player identity HTTP', () => {
  it('requires authentication and no-store', async () => {
    expect((await request('/game-accounts', { auth: false })).status).toBe(401);
    const response = await request('/game-accounts');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('exposes claimable game/platform pairs without internal state', async () => {
    const response = await request('/game-accounts/claimable-platforms');

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual([
      {
        game: {
          id: gameId,
          key: 'fc26',
          slug: 'fc-26',
          name: 'FC 26',
        },
        platform: {
          id: 'p1',
          key: 'pc',
          slug: 'pc',
          name: 'PC',
        },
        gamePlatformId,
      },
    ]);
  });

  it('creates only a pending claim through strict JSON and CSRF', async () => {
    const response = await request('/game-accounts', {
      method: 'POST',
      body: { gameId, gamePlatformId, handle: 'Player' },
    });
    expect(response.status).toBe(201);
    expect(await response.json()).not.toHaveProperty('normalizedHandle');
    expect(playerService.createGameAccountClaim).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', handle: 'Player' }),
    );
  });
  it('protects admin routes with permissions', async () => {
    authorization.hasPermission.mockResolvedValueOnce(false);
    expect((await request('/admin/game-accounts')).status).toBe(403);
    expect((await request('/admin/game-accounts')).status).toBe(200);
  });
  it('validates and forwards bounded backend pagination and date filters', async () => {
    expect((await request('/admin/game-accounts?pageSize=101')).status).toBe(400);
    expect(
      (
        await request(
          '/admin/game-accounts?submittedFrom=2026-08-03T00%3A00%3A00.000Z&submittedTo=2026-08-02T00%3A00%3A00.000Z',
        )
      ).status,
    ).toBe(400);
    const response = await request(
      `/admin/game-accounts?page=2&pageSize=25&status=PENDING&gameId=${gameId}&platformId=00000000-0000-4000-8000-000000000013&userSearch=Player`,
    );
    expect(response.status).toBe(200);
    expect(adminService.listPendingGameAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 25, status: 'PENDING', userSearch: 'Player' }),
    );
  });
  it('records the authenticated admin actor', async () => {
    const response = await request(`/admin/game-accounts/${accountId}/verify`, {
      method: 'POST',
      body: { expectedVersion: 3 },
    });
    expect(response.status).toBe(201);
    expect(adminService.review).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      accountId,
      action: 'VERIFY',
      expectedVersion: 3,
    });
  });
  it('maps unavailable persistence safely without leaking details', async () => {
    playerService.listMyGameAccounts.mockRejectedValueOnce(
      new PlayerIdentityError('PLAYER_IDENTITY_UNAVAILABLE'),
    );
    const response = await request('/game-accounts');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: 'PLAYER_IDENTITY_UNAVAILABLE',
        message: 'Player identity is temporarily unavailable.',
      },
    });
  });
  it('keeps routes registered and fails safely with the real DB-disabled provider', async () => {
    await application.close();
    application = await createApiApplication(config, false, { services: identityServices }, {}, {});
    await application.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
    const response = await request('/game-accounts');
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'PLAYER_IDENTITY_UNAVAILABLE' },
    });
  });
});
