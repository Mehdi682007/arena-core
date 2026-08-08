import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { EmailError } from '@arena-core/email';
import { createApiApplication } from '../dist/bootstrap.js';

let application;
let baseUrl;
let services;
let dispatcher;

const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
    AUTH_RATE_LIMIT_LOGIN_MAX: '2',
  },
  { packageVersion: '2.3.0', actualNodeVersion: process.versions.node },
);

function json(path, body, options = {}) {
  return globalThis.fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
      ...options.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(async () => {
  services = {
    identity: {
      registerUser: vi.fn(async () => ({
        userId: 'user-1',
        emailId: 'email-1',
        status: 'PENDING_VERIFICATION',
        verificationToken: 'verification-token-value-123456789',
        verificationExpiresAt: new Date('2026-07-26T00:00:00Z'),
      })),
      authenticateWithPassword: vi.fn(async () => ({
        authenticated: true,
        userId: 'user-1',
        securityVersion: 1,
        passwordRehashed: false,
      })),
      changePassword: vi.fn(async () => ({ securityVersion: 2 })),
    },
    sessions: {
      createSession: vi.fn(async () => ({
        sessionId: 'session-1',
        token: 'opaque-session-token-value-123456789',
        expiresAt: new Date('2026-08-24T00:00:00Z'),
      })),
      validateSession: vi.fn(async () => ({
        valid: true,
        userId: 'user-1',
        sessionId: 'session-1',
      })),
      revokeSession: vi.fn(async () => undefined),
      revokeAllUserSessions: vi.fn(async () => undefined),
      listUserSessions: vi.fn(async () => [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userId: 'user-1',
          status: 'ACTIVE',
          current: false,
          createdAt: new Date('2026-08-01T10:00:00Z'),
          lastSeenAt: new Date('2026-08-08T00:00:00Z'),
          expiresAt: new Date('2026-09-01T10:00:00Z'),
          revokedAt: null,
          userAgent: 'Vitest Browser',
        },
      ]),
      revokeUserSession: vi.fn(async () => true),
    },
    emailVerification: {
      requestEmailVerification: vi.fn(async () => ({
        accepted: true,
        email: 'player@example.com',
        token: 'verification-token-value-123456789',
        expiresAt: new Date('2026-07-26T00:00:00Z'),
      })),
      consumeEmailVerificationToken: vi.fn(async () => ({ userId: 'user-1' })),
    },
    passwordReset: {
      issuePasswordResetToken: vi.fn(async () => ({
        accepted: true,
        token: 'password-reset-token-value-123456789',
        expiresAt: new Date('2026-07-25T01:00:00Z'),
      })),
      consumePasswordResetToken: vi.fn(async () => ({
        userId: 'user-1',
        securityVersion: 2,
      })),
    },
  };
  dispatcher = {
    sendVerificationEmail: vi.fn(async () => undefined),
    sendPasswordResetEmail: vi.fn(async () => undefined),
  };
  application = await createApiApplication(config, false, {
    services,
    dispatcher,
    mfaService: {
      beginLoginChallenge: vi.fn(async () => ({
        required: false,
      })),
    },
  });
  await application.listen(0, '127.0.0.1');
  const address = application.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

afterEach(async () => {
  await application?.close();
  application = undefined;
});

describe('Identity HTTP integration with test adapter', () => {
  it('registers without exposing the verification token and dispatches it out of band', async () => {
    const response = await json('/auth/register', {
      email: 'player@example.com',
      password: 'a sufficiently long password',
      locale: 'fa',
      countryCode: 'IR',
    });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({
      userId: 'user-1',
      status: 'PENDING_VERIFICATION',
      verificationRequired: true,
      deliveryStatus: 'sent',
    });
    expect(JSON.stringify(body)).not.toContain('verification-token');
    expect(dispatcher.sendVerificationEmail).toHaveBeenCalledOnce();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps registration successful and request endpoints opaque when delivery fails', async () => {
    dispatcher.sendVerificationEmail.mockRejectedValue(
      new EmailError('EMAIL_DELIVERY_UNAVAILABLE'),
    );
    dispatcher.sendPasswordResetEmail.mockRejectedValue(new EmailError('EMAIL_DELIVERY_REJECTED'));
    const registration = await json('/auth/register', {
      email: 'player@example.com',
      password: 'a sufficiently long password',
    });
    expect(registration.status).toBe(201);
    expect(await registration.json()).toMatchObject({ deliveryStatus: 'pending' });

    const verification = await json('/auth/email-verification/request', {
      email: 'player@example.com',
    });
    const reset = await json('/auth/password-reset/request', {
      email: 'player@example.com',
    });
    expect(verification.status).toBe(202);
    expect(await verification.json()).toEqual({ accepted: true });
    expect(reset.status).toBe(202);
    expect(await reset.json()).toEqual({ accepted: true });
  });

  it('logs in with an HttpOnly opaque cookie and no token in JSON', async () => {
    const response = await json('/auth/login', {
      email: 'player@example.com',
      password: 'a sufficiently long password',
    });
    const body = await response.json();
    const cookie = response.headers.get('set-cookie');
    expect(response.status).toBe(200);
    expect(cookie).toContain('arena_session=opaque-session-token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=2592000');
    expect(JSON.stringify(body)).not.toContain('opaque-session-token');
  });

  it('protects me by default and injects only the safe principal', async () => {
    const missing = await globalThis.fetch(`${baseUrl}/auth/me`);
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });

    const valid = await globalThis.fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: 'arena_session=opaque-session-token-value-123456789' },
    });
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({
      user: { id: 'user-1', status: 'ACTIVE' },
      session: { id: 'session-1' },
    });
  });

  it('lists and revokes only user-owned sessions', async () => {
    const cookie = 'arena_session=opaque-session-token-value-123456789';

    const listed = await globalThis.fetch(`${baseUrl}/auth/sessions`, {
      headers: { cookie },
    });

    expect(listed.status).toBe(200);

    expect(await listed.json()).toEqual({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          status: 'ACTIVE',
          current: false,
          createdAt: '2026-08-01T10:00:00.000Z',
          lastSeenAt: '2026-08-08T00:00:00.000Z',
          expiresAt: '2026-09-01T10:00:00.000Z',
          userAgent: 'Vitest Browser',
        },
      ],
    });

    const revoked = await json(
      '/auth/sessions/11111111-1111-4111-8111-111111111111/revoke',
      {},
      { cookie },
    );

    expect(revoked.status).toBe(204);

    expect(services.sessions.revokeUserSession).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );

    const others = await json('/auth/sessions/revoke-others', {}, { cookie });

    expect(others.status).toBe(204);

    expect(services.sessions.revokeAllUserSessions).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('revokes current/all sessions and clears the matching cookie', async () => {
    for (const path of ['/auth/logout', '/auth/logout-all']) {
      const response = await json(
        path,
        {},
        {
          cookie: 'arena_session=opaque-session-token-value-123456789',
        },
      );
      expect(response.status).toBe(204);
      expect(response.headers.get('set-cookie')).toContain('arena_session=');
      expect(response.headers.get('set-cookie')).toContain('Path=/');
    }
    expect(services.sessions.revokeSession).toHaveBeenCalledWith('session-1');
    expect(services.sessions.revokeAllUserSessions).toHaveBeenCalledWith('user-1');
  });

  it('supports verification and reset flows without returning tokens', async () => {
    const verification = await json('/auth/email-verification/request', {
      email: 'player@example.com',
    });
    expect(verification.status).toBe(202);
    expect(await verification.json()).toEqual({ accepted: true });

    expect(
      (
        await json('/auth/email-verification/confirm', {
          token: 'verification-token-value-123456789',
        })
      ).status,
    ).toBe(204);

    const reset = await json('/auth/password-reset/request', {
      email: 'player@example.com',
    });
    expect(reset.status).toBe(202);
    expect(await reset.json()).toEqual({ accepted: true });
    expect(dispatcher.sendPasswordResetEmail).toHaveBeenCalledOnce();

    const confirmed = await json('/auth/password-reset/confirm', {
      token: 'password-reset-token-value-123456789',
      newPassword: 'another sufficiently long password',
    });
    expect(confirmed.status).toBe(204);
    expect(confirmed.headers.get('set-cookie')).toContain('arena_session=');
  });

  it('changes password only with a valid principal and clears the cookie', async () => {
    const response = await json(
      '/auth/password/change',
      {
        currentPassword: 'a sufficiently long password',
        newPassword: 'another sufficiently long password',
      },
      { cookie: 'arena_session=opaque-session-token-value-123456789' },
    );
    expect(response.status).toBe(204);
    expect(services.identity.changePassword).toHaveBeenCalledWith({
      userId: 'user-1',
      currentPassword: 'a sufficiently long password',
      newPassword: 'another sufficiently long password',
    });
  });

  it('redacts validation values and rejects unknown fields, origins, and content types', async () => {
    const invalid = await json('/auth/login', {
      email: 'x',
      password: 'secret-value-that-must-not-echo',
      admin: true,
    });
    const text = await invalid.text();
    expect(invalid.status).toBe(400);
    expect(text).not.toContain('secret-value-that-must-not-echo');
    expect(text).not.toContain('true');

    const origin = await json(
      '/auth/login',
      { email: 'player@example.com', password: 'password' },
      { headers: { origin: 'https://evil.example' } },
    );
    expect(origin.status).toBe(403);

    const contentType = await globalThis.fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'text/plain' },
      body: '{}',
    });
    expect(contentType.status).toBe(415);

    const missingOrigin = await globalThis.fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(missingOrigin.status).toBe(403);
  });

  it('rejects malformed/oversized JSON and malformed cookies without leaking input', async () => {
    const malformed = await globalThis.fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
      },
      body: '{"password":"sensitive"',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.text()).not.toContain('sensitive');

    const oversized = await globalThis.fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ padding: 'x'.repeat(20_000) }),
    });
    expect(oversized.status).toBe(413);

    const cookie = await globalThis.fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: `arena_session=${'x'.repeat(600)}` },
    });
    expect(cookie.status).toBe(401);
  });

  it('rate limits by endpoint/IP and emits Retry-After', async () => {
    for (let index = 0; index < 2; index += 1) {
      expect(
        (
          await json('/auth/login', {
            email: 'player@example.com',
            password: 'a sufficiently long password',
          })
        ).status,
      ).toBe(200);
    }
    const limited = await json('/auth/login', {
      email: 'different@example.com',
      password: 'a sufficiently long password',
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect(await limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('keeps health public', async () => {
    const response = await globalThis.fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
  });
});
