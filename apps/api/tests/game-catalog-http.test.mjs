import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { CatalogError } from '@arena-core/game-catalog';
import { createApiApplication } from '../dist/bootstrap.js';

let application, baseUrl, publicService, adminService, rulesetService, authorization;
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '3.1.0', actualNodeVersion: process.versions.node },
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
const game = {
  id: '00000000-0000-4000-8000-000000000001',
  key: 'football',
  slug: 'football-2026',
  name: 'Football 2026',
  shortName: 'Football',
  description: null,
  platforms: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      key: 'pc',
      slug: 'pc',
      name: 'PC',
      family: 'PC',
      isDefault: true,
    },
  ],
  modes: [
    {
      id: '00000000-0000-4000-8000-000000000003',
      key: 'one_v_one',
      slug: 'one-v-one',
      name: '1v1',
      description: null,
      teamSizeMin: 1,
      teamSizeMax: 1,
      participantCountMin: 2,
      participantCountMax: 2,
    },
  ],
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
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}
beforeEach(async () => {
  publicService = {
    listGames: vi.fn(async () => [game]),
    getGame: vi.fn(async () => game),
    getDefaultRuleset: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000004',
      key: 'standard',
      version: 1,
      name: 'Standard',
      gameModeId: '00000000-0000-4000-8000-000000000003',
      configuration: { schemaVersion: 1, settings: { rounds: 1 } },
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })),
  };
  adminService = {
    createGame: vi.fn(async () => ({ id: 'g', status: 'DRAFT' })),
    updateGame: vi.fn(async () => ({ id: 'g', status: 'ACTIVE' })),
    createPlatform: vi.fn(async () => ({ id: 'p', status: 'ACTIVE' })),
    attachPlatform: vi.fn(async () => ({ id: 'gp', status: 'ACTIVE' })),
    createMode: vi.fn(async () => ({ id: 'm', status: 'DRAFT' })),
    createCrossplayGroup: vi.fn(async () => ({ id: 'c', status: 'ACTIVE' })),
    setCrossplayPlatforms: vi.fn(async () => ({ id: 'c', status: 'ACTIVE' })),
  };
  rulesetService = {
    createDraft: vi.fn(async () => ({ id: 'r', status: 'DRAFT' })),
    updateDraft: vi.fn(async () => ({ id: 'r', status: 'DRAFT' })),
    publish: vi.fn(async () => ({ id: 'r', status: 'ACTIVE' })),
    setDefault: vi.fn(async () => ({ id: 'r', status: 'ACTIVE', isDefault: true })),
    transition: vi.fn(async () => ({ id: 'r', status: 'ARCHIVED' })),
  };
  authorization = { hasPermission: vi.fn(async () => true) };
  application = await createApiApplication(
    config,
    false,
    { services: identityServices },
    {},
    {
      publicService,
      adminService,
      rulesetService,
      authorization,
    },
  );
  await application.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
});
afterEach(async () => {
  await application?.close();
  application = undefined;
});

describe('public game catalog HTTP', () => {
  it.each([
    '/catalog/games',
    '/catalog/games/football-2026',
    '/catalog/games/football-2026/rulesets/default',
  ])('is anonymous and cacheable: %s', async (path) => {
    const response = await request(path, { auth: false });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, stale-while-revalidate=300',
    );
    expect(response.headers.get('pragma')).toBe('');
  });
  it('does not expose internal catalog fields', async () => {
    const response = await request('/catalog/games/football-2026', { auth: false });
    expect(JSON.stringify(await response.json())).not.toMatch(
      /status|sortOrder|createdAt|updatedAt|archivedAt|isVisible/,
    );
  });
  it('maps catalog unavailability safely', async () => {
    publicService.listGames.mockRejectedValueOnce(new CatalogError('GAME_CATALOG_UNAVAILABLE'));
    const response = await request('/catalog/games', { auth: false });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'GAME_CATALOG_UNAVAILABLE' } });
  });
});

describe('catalog administration authorization', () => {
  const body = {
    key: 'football',
    slug: 'football-2026',
    name: 'Football',
    shortName: 'Football',
  };
  it('requires authentication', async () => {
    expect(
      (await request('/admin/catalog/games', { method: 'POST', auth: false, body })).status,
    ).toBe(401);
  });
  it('defaults to deny when games.manage is absent', async () => {
    authorization.hasPermission.mockResolvedValueOnce(false);
    const response = await request('/admin/catalog/games', { method: 'POST', body });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(adminService.createGame).not.toHaveBeenCalled();
  });
  it('permits games.manage and keeps admin responses private', async () => {
    const response = await request('/admin/catalog/games', { method: 'POST', body });
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(authorization.hasPermission).toHaveBeenCalledWith('user-1', 'games.manage');
  });
  it('enforces strict DTO and CSRF origin', async () => {
    expect(
      (await request('/admin/catalog/games', { method: 'POST', body: { ...body, extra: true } }))
        .status,
    ).toBe(400);
    expect(
      (
        await request('/admin/catalog/games', {
          method: 'POST',
          body,
          headers: { origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403);
  });
  it('rejects invalid UUID parameters and supports crossplay assignment', async () => {
    const invalid = await request('/admin/catalog/games/not-a-uuid/modes', {
      method: 'POST',
      body: {
        key: 'one_v_one',
        slug: 'one-v-one',
        name: '1v1',
        teamSizeMin: 1,
        teamSizeMax: 1,
        participantCountMin: 2,
        participantCountMax: 2,
      },
    });
    expect(invalid.status).toBe(400);

    const gameId = '00000000-0000-4000-8000-000000000001';
    const groupId = '00000000-0000-4000-8000-000000000005';
    const assigned = await request(
      `/admin/catalog/games/${gameId}/crossplay-groups/${groupId}/platforms`,
      {
        method: 'PATCH',
        body: { gamePlatformIds: ['00000000-0000-4000-8000-000000000006'] },
      },
    );
    expect(assigned.status).toBe(200);
    expect(adminService.setCrossplayPlatforms).toHaveBeenCalledOnce();
  });
});

describe('database-disabled runtime safety', () => {
  it('keeps health available and catalog safely unavailable', async () => {
    await application.close();
    application = await createApiApplication(config, false, { services: identityServices });
    await application.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
    expect((await request('/health', { auth: false })).status).toBe(200);
    const response = await request('/catalog/games', { auth: false });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'GAME_CATALOG_UNAVAILABLE' } });
  });
});
