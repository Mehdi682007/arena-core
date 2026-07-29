import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { createApiApplication } from '../dist/bootstrap.js';
const userId = '00000000-0000-4000-8000-000000000701';
const id = '00000000-0000-4000-8000-000000000702';
const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '7.1.0', actualNodeVersion: process.versions.node },
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
async function start(overrides) {
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
    overrides,
  );
  await app.listen(0, '127.0.0.1');
  baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
}
afterEach(async () => {
  await app?.close();
  app = undefined;
});
describe('notification HTTP integration', () => {
  it('protects private projections, no-store, strict DTO, CSRF and admin permission', async () => {
    const notificationService = {
      list: vi.fn(async () => ({
        items: [{ id, type: 'RATING_UPDATED', data: { delta: 20 } }],
        nextCursor: null,
      })),
      unreadCount: vi.fn(async () => ({ count: 1 })),
      detail: vi.fn(),
      markRead: vi.fn(async () => ({ id })),
      markUnread: vi.fn(),
      archive: vi.fn(),
    };
    const preferenceService = { list: vi.fn(async () => []), update: vi.fn() };
    const adminService = {
      list: vi.fn(async () => ({ items: [], nextCursor: null })),
      detail: vi.fn(),
      deadLetter: vi.fn(),
      retry: vi.fn(),
      releaseClaims: vi.fn(),
    };
    const authorization = { hasPermission: vi.fn(async () => false) };
    await start({ notificationService, preferenceService, adminService, authorization });
    expect((await request('/notifications', { auth: false })).status).toBe(401);
    const response = await request('/notifications?limit=10');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toMatch(/email|providerError|opponentUserId/);
    expect((await request('/admin/notifications/outbox?limit=10')).status).toBe(403);
    expect(
      (
        await request(`/notifications/${id}/read`, {
          method: 'POST',
          origin: 'http://evil.invalid',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request('/notification-preferences/RATING_UPDATED', {
          method: 'PUT',
          body: { inAppEnabled: true, emailEnabled: false, extra: true },
        })
      ).status,
    ).toBe(400);
  });
  it('fails closed with the database disabled', async () => {
    await start({ authorization: { hasPermission: vi.fn(async () => true) } });
    const response = await request('/notifications');
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('NOTIFICATION_SERVICE_UNAVAILABLE');
  });
  it('routes the complete user and admin lifecycle through strict private services', async () => {
    const view = { id, type: 'RATING_UPDATED', data: { delta: 20 } };
    const outboxView = {
      id,
      notificationId: id,
      channel: 'IN_APP',
      status: 'FAILED',
      availableAt: new Date(),
      attemptCount: 1,
      lastAttemptAt: null,
      deliveredAt: null,
      failedAt: new Date(),
      deadLetteredAt: null,
      lastErrorCode: 'REDACTED',
      version: 1,
      notification: { type: 'RATING_UPDATED' },
    };
    const notificationService = {
      list: vi.fn(async () => ({ items: [view], nextCursor: null })),
      unreadCount: vi.fn(async () => ({ count: 1 })),
      detail: vi.fn(async () => view),
      markRead: vi.fn(async () => view),
      markUnread: vi.fn(async () => view),
      archive: vi.fn(async () => view),
    };
    const preferenceService = {
      list: vi.fn(async () => []),
      update: vi.fn(async () => ({
        type: 'RATING_UPDATED',
        inAppEnabled: true,
        emailEnabled: false,
      })),
    };
    const adminService = {
      list: vi.fn(async () => ({ items: [], nextCursor: null })),
      detail: vi.fn(async () => outboxView),
      deadLetter: vi.fn(async () => ({ items: [], nextCursor: null })),
      retry: vi.fn(async () => ({ ...outboxView, status: 'RETRY_SCHEDULED' })),
      releaseClaims: vi.fn(async () => 1),
    };
    await start({
      notificationService,
      preferenceService,
      adminService,
      authorization: { hasPermission: vi.fn(async () => true) },
    });
    for (const path of [
      `/notifications/${id}`,
      '/notifications/unread-count',
      '/notification-preferences',
      '/admin/notifications/outbox?limit=10',
      '/admin/notifications/outbox/dead-letter',
      `/admin/notifications/outbox/${id}`,
    ])
      expect((await request(path)).status).toBe(200);
    for (const path of [
      `/notifications/${id}/read`,
      `/notifications/${id}/unread`,
      `/notifications/${id}/archive`,
      `/admin/notifications/outbox/${id}/retry`,
    ])
      expect((await request(path, { method: 'POST' })).status).toBe(201);
    expect(
      (
        await request('/notification-preferences/RATING_UPDATED', {
          method: 'PUT',
          body: { inAppEnabled: true, emailEnabled: false },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request('/admin/notifications/recovery/claims', {
          method: 'POST',
          body: { limit: 10 },
        })
      ).status,
    ).toBe(201);
    expect(JSON.stringify(await adminService.detail.mock.results[0].value)).not.toMatch(
      /smtp|email|provider response/i,
    );
  });
  it('redacts operational outbox internals at the HTTP boundary', async () => {
    const unsafe = {
      id,
      notificationId: id,
      channel: 'EMAIL',
      status: 'FAILED',
      deduplicationKey: 'private-dedup',
      availableAt: new Date(),
      attemptCount: 2,
      lastAttemptAt: new Date(),
      deliveredAt: null,
      failedAt: new Date(),
      deadLetteredAt: null,
      lastErrorCode: 'SMTP_TEMPORARY',
      payloadSnapshot: { secret: 'private' },
      claimToken: 'private-claim',
      claimExpiresAt: new Date(),
      version: 1,
      notification: {
        recipientUserId: userId,
        type: 'RATING_UPDATED',
        subject: 'subject',
        body: 'body',
        locale: 'fa',
      },
    };
    await start({
      adminService: {
        list: vi.fn(async () => ({ items: [unsafe], nextCursor: null })),
        detail: vi.fn(async () => unsafe),
        deadLetter: vi.fn(async () => ({ items: [unsafe], nextCursor: null })),
        retry: vi.fn(async () => unsafe),
      },
      authorization: { hasPermission: vi.fn(async () => true) },
    });
    const response = await request(`/admin/notifications/outbox/${id}`);
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toMatch(/private-dedup|private-claim|recipientUserId|payloadSnapshot/);
    expect(text).toContain('SMTP_TEMPORARY');
  });
});
