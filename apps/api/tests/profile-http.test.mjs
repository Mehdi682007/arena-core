import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { ProfileError } from '@arena-core/identity';
import { createApiApplication } from '../dist/bootstrap.js';

let application;
let baseUrl;
let profiles;
const publicUserId = '00000000-0000-4000-8000-000000000777';

const config = createApiConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
    AUTH_REQUIRE_ORIGIN: 'true',
  },
  { packageVersion: '2.5.0', actualNodeVersion: process.versions.node },
);

const identityServices = {
  identity: {},
  sessions: {
    validateSession: vi.fn(async () => ({
      valid: true,
      userId: 'user-1',
      sessionId: 'session-1',
    })),
  },
  emailVerification: {},
  passwordReset: {},
};

const complete = {
  profile: {
    displayName: 'Mehdi',
    locale: 'fa',
    timezone: 'Asia/Tehran',
    countryCode: 'IR',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  },
  onboarding: { completed: true, missingSteps: [] },
};

function request(path, options = {}) {
  return globalThis.fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.auth === false
        ? {}
        : { cookie: 'arena_session=opaque-session-token-value-123456789' }),
      ...(options.method === undefined || options.method === 'GET'
        ? {}
        : { 'content-type': 'application/json', origin: 'http://localhost:3000' }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

beforeEach(async () => {
  profiles = {
    getPublicProfile: vi.fn(async (userId) => ({ userId, displayName: 'Public Player' })),
    getCurrentUserProfile: vi.fn(async () => complete),
    updateCurrentUserProfile: vi.fn(async () => complete),
    getOnboardingStatus: vi.fn(async () => complete.onboarding),
    completeIdentityOnboarding: vi.fn(async () => complete.onboarding),
  };
  application = await createApiApplication(
    config,
    false,
    { services: identityServices },
    { service: profiles },
  );
  await application.listen(0, '127.0.0.1');
  const address = application.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

afterEach(async () => {
  await application?.close();
  application = undefined;
});

describe('private profile HTTP integration', () => {
  it('serves only the anonymous public projection', async () => {
    const response = await request(`/profiles/${publicUserId}`, { auth: false });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ userId: publicUserId, displayName: 'Public Player' });
    expect(JSON.stringify(body)).not.toMatch(
      /locale|timezone|country|email|session|security|onboarding|deleted|status/i,
    );
    expect(profiles.getPublicProfile).toHaveBeenCalledWith(publicUserId);
  });

  it('rejects malformed public profile identifiers and maps missing profiles safely', async () => {
    expect((await request('/profiles/not-a-uuid', { auth: false })).status).toBe(400);
    profiles.getPublicProfile.mockRejectedValueOnce(new ProfileError('PROFILE_NOT_AVAILABLE'));
    const missing = await request(`/profiles/${publicUserId}`, { auth: false });
    expect(missing.status).toBe(404);
  });

  it('returns only the current safe profile with no-store', async () => {
    const response = await request('/profile');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toEqual({
      profile: {
        displayName: 'Mehdi',
        locale: 'fa',
        timezone: 'Asia/Tehran',
        countryCode: 'IR',
      },
      onboarding: { completed: true, missingSteps: [] },
    });
    expect(JSON.stringify(body)).not.toMatch(/password|token|securityVersion|sessionId|profileId/i);
    expect(profiles.getCurrentUserProfile).toHaveBeenCalledWith('user-1');
  });

  it('protects profile and onboarding routes', async () => {
    for (const path of ['/profile', '/onboarding']) {
      const response = await request(path, { auth: false });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    }
  });

  it('updates a strict partial profile and permits country clearing', async () => {
    const response = await request('/profile', {
      method: 'PATCH',
      body: { displayName: 'مهدی', countryCode: null },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(profiles.updateCurrentUserProfile).toHaveBeenCalledWith({
      userId: 'user-1',
      displayName: 'مهدی',
      countryCode: null,
    });
  });

  it.each([
    [{}, 'body'],
    [{ unknown: true }, 'body'],
    [{ displayName: null }, 'displayName'],
    [{ locale: 'de' }, 'locale'],
    [{ timezone: 'x'.repeat(65) }, 'timezone'],
    [{ countryCode: 'INVALID' }, 'countryCode'],
  ])('rejects invalid DTOs without echoing values', async (body, field) => {
    const response = await request('/profile', { method: 'PATCH', body });
    const text = await response.text();
    expect(response.status).toBe(400);
    expect(text).toContain(field);
    expect(text).not.toContain('INVALID');
    expect(profiles.updateCurrentUserProfile).not.toHaveBeenCalled();
  });

  it('enforces CSRF origin and JSON content type on writes', async () => {
    const origin = await request('/profile', {
      method: 'PATCH',
      body: { locale: 'fa' },
      headers: { origin: 'https://evil.example' },
    });
    expect(origin.status).toBe(403);

    const contentType = await request('/onboarding/complete', {
      method: 'POST',
      body: {},
      headers: { 'content-type': 'text/plain' },
    });
    expect(contentType.status).toBe(415);
  });

  it('returns onboarding and completes it idempotently', async () => {
    const status = await request('/onboarding');
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ completed: true, missingSteps: [] });

    for (let index = 0; index < 2; index += 1) {
      const completed = await request('/onboarding/complete', {
        method: 'POST',
        body: {},
      });
      expect(completed.status).toBe(200);
      expect(await completed.json()).toEqual({ completed: true, missingSteps: [] });
    }
  });

  it('maps incomplete and persistence errors safely', async () => {
    profiles.completeIdentityOnboarding.mockRejectedValueOnce(
      new ProfileError('ONBOARDING_INCOMPLETE'),
    );
    const incomplete = await request('/onboarding/complete', {
      method: 'POST',
      body: {},
    });
    expect(incomplete.status).toBe(409);
    expect(await incomplete.json()).toMatchObject({
      error: { code: 'ONBOARDING_INCOMPLETE' },
    });

    profiles.getCurrentUserProfile.mockRejectedValueOnce(
      new ProfileError('PROFILE_DATABASE_DISABLED'),
    );
    const unavailable = await request('/profile');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: { code: 'PROFILE_SERVICE_UNAVAILABLE' },
    });
  });

  it('keeps production profile wiring safe when database persistence is disabled', async () => {
    await application.close();
    application = await createApiApplication(config, false, { services: identityServices });
    await application.listen(0, '127.0.0.1');
    const address = application.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    const unauthenticated = await request('/profile', { auth: false });
    expect(unauthenticated.status).toBe(401);

    const unavailable = await request('/profile');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: { code: 'PROFILE_SERVICE_UNAVAILABLE' },
    });
  });
});
