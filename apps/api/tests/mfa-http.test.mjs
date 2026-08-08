import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { createApiApplication } from '../dist/bootstrap.js';

let application;
let baseUrl;
let mfaService;

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
    packageVersion: '5.0.0',
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
  const sessions = {
    validateSession: vi.fn(async () => ({
      valid: true,
      userId: 'user-1',
      sessionId: 'session-1',
    })),
  };

  const services = {
    identity: {},
    sessions,
    emailVerification: {},
    passwordReset: {},
  };

  mfaService = {
    status: vi.fn(async () => ({
      enabled: false,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    })),

    startTotpEnrollment: vi.fn(async () => ({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUri: 'otpauth://totp/Arena%20Core%3Atest?secret=JBSWY3DPEHPK3PXP',
    })),

    confirmTotpEnrollment: vi.fn(async () => ({
      recoveryCodes: ['AAAA-BBBB-CCCC', 'DDDD-EEEE-FFFF'],
    })),
  };

  application = await createApiApplication(config, false, {
    services,
    mfaService,
  });

  await application.listen(0, '127.0.0.1');

  baseUrl = `http://127.0.0.1:${application.getHttpServer().address().port}/api/v1`;
});

afterEach(async () => {
  await application?.close();
});

describe('MFA HTTP', () => {
  it('returns authenticated MFA status', async () => {
    const response = await request('/auth/mfa');

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      enabled: false,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    });

    const unauthenticated = await request('/auth/mfa', { auth: false });

    expect(unauthenticated.status).toBe(401);
  });

  it('starts TOTP enrollment', async () => {
    const response = await request('/auth/mfa/totp/enroll/start', {
      method: 'POST',
      body: {},
    });

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.secret).toBe('JBSWY3DPEHPK3PXP');

    expect(body.otpauthUri).toContain('otpauth://totp/');
  });

  it('confirms enrollment and returns recovery codes once', async () => {
    const response = await request('/auth/mfa/totp/enroll/confirm', {
      method: 'POST',
      body: {
        code: '123456',
      },
    });

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      enabled: true,
      recoveryCodes: ['AAAA-BBBB-CCCC', 'DDDD-EEEE-FFFF'],
    });

    expect(mfaService.confirmTotpEnrollment).toHaveBeenCalledWith('user-1', 'session-1', '123456');
  });
});
