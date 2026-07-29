import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { createApiApplication } from '../dist/bootstrap.js';
const userId = '00000000-0000-4000-8000-000000000801';
const id = '00000000-0000-4000-8000-000000000802';
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '7.2.0', actualNodeVersion: process.versions.node },
);
const identity = {
  identity: {},
  sessions: { validateSession: vi.fn(async () => ({ valid: true, userId, sessionId: 's1' })) },
  emailVerification: {},
  passwordReset: {},
};
let app;
let baseUrl;
const request = (path, options = {}) =>
  globalThis.fetch(`${baseUrl}${path}`, {
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
async function start(admin) {
  app = await createApiApplication(
    config,
    false,
    { services: identity },
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    admin,
  );
  await app.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
}
afterEach(async () => {
  await app?.close();
  app = undefined;
});
describe('administrative operations HTTP', () => {
  it('projects only allowlisted administrative capabilities for the session', async () => {
    const authorization = {
      hasPermission: vi.fn(async () => true),
      listPermissions: vi.fn(async () => [
        'audit.read',
        'notifications.read',
        'unrelated.internal',
      ]),
    };
    await start({ authorization });
    const response = await request('/admin/capabilities');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      permissions: ['audit.read', 'notifications.read'],
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('requires session and permission and emits no-store', async () => {
    const audit = { list: vi.fn(async () => ({ items: [], nextCursor: null })), detail: vi.fn() };
    await start({ audit, authorization: { hasPermission: vi.fn(async () => false) } });
    expect((await request('/admin/audit', { auth: false })).status).toBe(401);
    expect((await request('/admin/audit')).status).toBe(403);
    await app.close();
    app = undefined;
    await start({ audit, authorization: { hasPermission: vi.fn(async () => true) } });
    const response = await request('/admin/audit');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('routes safe projections and rejects unknown DTO and CSRF failures', async () => {
    const safe = { id, status: 'ACTIVE' };
    await start({
      audit: {
        list: vi.fn(async () => ({ items: [], nextCursor: null })),
        detail: vi.fn(async () => safe),
      },
      search: { search: vi.fn(async () => [safe]) },
      timeline: { user: vi.fn(async () => [safe]), match: vi.fn(async () => [safe]) },
      support: {
        retry: vi.fn(async () => safe),
        recover: vi.fn(async () => ({ recovered: true })),
      },
      authorization: { hasPermission: vi.fn(async () => true) },
    });
    expect((await request('/admin/search?scope=USER&term=test')).status).toBe(200);
    expect((await request(`/admin/users/${id}/timeline`)).status).toBe(200);
    expect((await request(`/admin/matches/${id}/timeline`)).status).toBe(200);
    expect((await request('/admin/audit?unknown=true')).status).toBe(400);
    expect(
      (
        await request(`/admin/support/notifications/${id}/retry`, {
          method: 'POST',
          body: {},
          origin: 'http://evil.invalid',
        })
      ).status,
    ).toBe(403);
    const text = await (await request('/admin/search?scope=USER&term=test')).text();
    expect(text).not.toMatch(
      /passwordHash|tokenHash|sessionToken|normalizedHandle|walletId|ledgerAccountId|escrowId|providerError|secret/i,
    );
  });
  it('returns 503 for permitted database-disabled operations', async () => {
    await start({ authorization: { hasPermission: vi.fn(async () => true) } });
    const response = await request('/admin/audit');
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('ADMIN_OPERATIONS_UNAVAILABLE');
  });
  it('protects diagnostics and returns a safe DB-disabled projection', async () => {
    await start({ authorization: { hasPermission: vi.fn(async () => false) } });
    expect((await request('/admin/diagnostics', { auth: false })).status).toBe(401);
    expect((await request('/admin/diagnostics')).status).toBe(403);
    await app.close();
    app = undefined;
    await start({ authorization: { hasPermission: vi.fn(async () => true) } });
    const response = await request('/admin/diagnostics');
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      service: 'api',
      environment: 'test',
      dependencies: { database: 'disabled', smtp: 'disabled' },
      migrationMode: 'external',
    });
    expect(JSON.stringify(body)).not.toMatch(/password|secret|postgresql:|cookie/i);
  });
});
