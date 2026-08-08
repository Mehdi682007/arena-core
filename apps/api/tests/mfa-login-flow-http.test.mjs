import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { createApiApplication } from '../dist/bootstrap.js';

let application;
let baseUrl;
let services;
let phoneService;
let mfaService;

const verifiedAt = new Date('2026-08-08T02:30:00Z');

const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
    AUTH_RATE_LIMIT_LOGIN_MAX: '20',
  },
  {
    packageVersion: '5.2.0',
    actualNodeVersion: process.versions.node,
  },
);

function request(path, body) {
  return globalThis.fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  services = {
    identity: {
      authenticateWithPassword: vi.fn(async () => ({
        authenticated: true,
        userId: 'user-1',
        securityVersion: 7,
        passwordRehashed: false,
      })),
    },

    sessions: {
      validateSession: vi.fn(),

      createSession: vi.fn(async () => ({
        sessionId: 'session-new',
        token: 'opaque-new-session-token-value-123456789',
        expiresAt: new Date('2026-09-08T00:00:00Z'),
      })),
    },

    emailVerification: {},
    passwordReset: {},
  };

  phoneService = {
    requestSignIn: vi.fn(),

    confirmSignIn: vi.fn(async () => ({
      userId: 'user-1',
      securityVersion: 7,
    })),

    listUserPhones: vi.fn(),

    requestVerification: vi.fn(),

    confirmVerification: vi.fn(),
  };

  mfaService = {
    status: vi.fn(),

    startTotpEnrollment: vi.fn(),

    confirmTotpEnrollment: vi.fn(),

    beginLoginChallenge: vi.fn(async () => ({
      required: true,
      challengeToken: 'short-lived-mfa-challenge-token-value-123456',
      expiresAt: new Date('2026-08-08T02:35:00Z'),
    })),

    confirmLoginChallenge: vi.fn(async () => ({
      userId: 'user-1',
      securityVersion: 7,
      mfaVerifiedAt: verifiedAt,
    })),
  };

  application = await createApiApplication(config, false, {
    services,
    phoneService,
    smsDispatcher: {
      sendOtp: vi.fn(async () => undefined),
    },
    mfaService,
  });

  await application.listen(0, '127.0.0.1');

  const address = application.getHttpServer().address();

  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

afterEach(async () => {
  await application?.close();
});

describe('MFA login HTTP flow', () => {
  it('stops password login before session creation when MFA is required', async () => {
    const response = await request('/auth/login', {
      email: 'player@example.com',
      password: 'a sufficiently long password',
    });

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      mfaRequired: true,
      challengeToken: 'short-lived-mfa-challenge-token-value-123456',
      expiresAt: '2026-08-08T02:35:00.000Z',
    });

    expect(services.sessions.createSession).not.toHaveBeenCalled();

    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('stops phone login before session creation when MFA is required', async () => {
    const response = await request('/auth/phone/sign-in/confirm', {
      challengeId: '11111111-1111-4111-8111-111111111111',
      code: '123456',
    });

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      mfaRequired: true,
      challengeToken: 'short-lived-mfa-challenge-token-value-123456',
      expiresAt: '2026-08-08T02:35:00.000Z',
    });

    expect(services.sessions.createSession).not.toHaveBeenCalled();

    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('creates an MFA-verified session after challenge confirmation', async () => {
    const response = await request('/auth/mfa/challenge/confirm', {
      challengeToken: 'short-lived-mfa-challenge-token-value-123456',
      code: '123456',
    });

    expect(response.status).toBe(200);

    expect(mfaService.confirmLoginChallenge).toHaveBeenCalledWith({
      challengeToken: 'short-lived-mfa-challenge-token-value-123456',
      code: '123456',
    });

    expect(services.sessions.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        securityVersion: 7,
        mfaVerifiedAt: verifiedAt,
      }),
    );

    expect(response.headers.get('set-cookie')).toContain('arena_session=');

    expect(await response.json()).toEqual({
      user: {
        id: 'user-1',
        status: 'ACTIVE',
      },
      session: {
        expiresAt: '2026-09-08T00:00:00.000Z',
        mfaVerifiedAt: '2026-08-08T02:30:00.000Z',
      },
    });
  });

  it('preserves direct session creation when MFA is disabled', async () => {
    mfaService.beginLoginChallenge.mockResolvedValueOnce({
      required: false,
    });

    const response = await request('/auth/login', {
      email: 'player@example.com',
      password: 'a sufficiently long password',
    });

    expect(response.status).toBe(200);

    expect(services.sessions.createSession).toHaveBeenCalledTimes(1);

    expect(response.headers.get('set-cookie')).toContain('arena_session=');
  });
});
