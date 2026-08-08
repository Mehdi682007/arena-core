import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { createApiApplication } from '../dist/bootstrap.js';

let application;
let baseUrl;
let phoneService;
let smsDispatcher;
let sessions;

const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  {
    packageVersion: '4.0.0',
    actualNodeVersion: process.versions.node,
  },
);

function request(path, options = {}) {
  return globalThis.fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.auth === false
        ? {}
        : {
            cookie: 'arena_session=opaque-session-token-value-123456789',
          }),
      ...(options.method && options.method !== 'GET'
        ? {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
          }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

beforeEach(async () => {
  sessions = {
    validateSession: vi.fn(async () => ({
      valid: true,
      userId: 'user-1',
      sessionId: 'session-1',
    })),
    createSession: vi.fn(async () => ({
      sessionId: 'session-new',
      token: 'opaque-new-session-token-value-123456789',
      expiresAt: new Date('2026-09-01T00:00:00Z'),
    })),
  };

  phoneService = {
    requestSignIn: vi.fn(async () => ({
      challengeId: '11111111-1111-4111-8111-111111111111',
      purpose: 'SIGN_IN',
      expiresAt: new Date('2026-08-08T00:05:00Z'),
      delivery: {
        to: '+989121234567',
        code: '123456',
      },
    })),

    confirmSignIn: vi.fn(async () => ({
      userId: 'user-1',
      securityVersion: 3,
    })),

    listUserPhones: vi.fn(async () => [
      {
        id: 'phone-1',
        phoneE164: '+989121234567',
        isPrimary: true,
        verifiedAt: new Date('2026-08-01T00:00:00Z'),
        createdAt: new Date('2026-08-01T00:00:00Z'),
      },
    ]),

    requestVerification: vi.fn(async () => ({
      challengeId: '22222222-2222-4222-8222-222222222222',
      purpose: 'VERIFY_PHONE',
      expiresAt: new Date('2026-08-08T00:05:00Z'),
      delivery: {
        to: '+989121234567',
        code: '654321',
      },
    })),

    confirmVerification: vi.fn(async () => ({
      id: 'phone-1',
      phoneE164: '+989121234567',
      isPrimary: true,
      verifiedAt: new Date('2026-08-08T00:01:00Z'),
      createdAt: new Date('2026-08-01T00:00:00Z'),
    })),
  };

  smsDispatcher = {
    sendOtp: vi.fn(async () => undefined),
  };

  const services = {
    identity: {},
    sessions,
    emailVerification: {},
    passwordReset: {},
  };

  application = await createApiApplication(config, false, {
    services,
    phoneService,
    smsDispatcher,
    mfaService: {
      beginLoginChallenge: vi.fn(async () => ({
        required: false,
      })),
    },
  });

  await application.listen(0, '127.0.0.1');

  baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
});

afterEach(async () => {
  await application?.close();
});

describe('phone identity HTTP', () => {
  it('requests sign-in without exposing the OTP code', async () => {
    const response = await request('/auth/phone/sign-in/request', {
      auth: false,
      method: 'POST',
      body: {
        phone: '+989121234567',
        locale: 'fa',
      },
    });

    expect(response.status).toBe(202);

    const body = await response.json();

    expect(body).toEqual({
      accepted: true,
      challengeId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-08T00:05:00.000Z',
    });

    expect(body).not.toHaveProperty('code');

    expect(smsDispatcher.sendOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+989121234567',
        code: '123456',
        purpose: 'SIGN_IN',
      }),
    );
  });

  it('confirms phone sign-in and creates the normal session cookie', async () => {
    const response = await request('/auth/phone/sign-in/confirm', {
      auth: false,
      method: 'POST',
      body: {
        challengeId: '11111111-1111-4111-8111-111111111111',
        code: '123456',
      },
    });

    expect(response.status).toBe(200);

    expect(sessions.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        securityVersion: 3,
      }),
    );

    expect(response.headers.get('set-cookie')).toContain('arena_session=');
  });

  it('lists only authenticated user phones', async () => {
    const response = await request('/auth/phone');

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      items: [
        {
          id: 'phone-1',
          phoneE164: '+989121234567',
          isPrimary: true,
          verifiedAt: '2026-08-01T00:00:00.000Z',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });

    expect(await request('/auth/phone', { auth: false })).toHaveProperty('status', 401);
  });

  it('supports authenticated phone verification', async () => {
    const requestResponse = await request('/auth/phone/verification/request', {
      method: 'POST',
      body: {
        phone: '+989121234567',
        locale: 'fa',
      },
    });

    expect(requestResponse.status).toBe(202);

    const confirm = await request('/auth/phone/verification/confirm', {
      method: 'POST',
      body: {
        challengeId: '22222222-2222-4222-8222-222222222222',
        code: '654321',
      },
    });

    expect(confirm.status).toBe(200);

    expect(phoneService.confirmVerification).toHaveBeenCalledWith({
      userId: 'user-1',
      challengeId: '22222222-2222-4222-8222-222222222222',
      code: '654321',
    });
  });
});
