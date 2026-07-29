import { describe, expect, it, vi } from 'vitest';
import {
  ConfigurationError,
  SecretValue,
  createApiConfig,
  createWebConfig,
  createWorkerConfig,
} from '../src/index';

const options = {
  packageVersion: '1.2.3',
  actualNodeVersion: '24.14.0',
  engineRange: '>=24.14.0 <25',
  pinnedNodeVersion: '24.18.0',
} as const;

describe('central configuration', () => {
  it('provides safe development web defaults and a pin warning', () => {
    const config = createWebConfig({}, options);
    expect(config).toMatchObject({
      runtime: { environment: 'development', version: '1.2.3', logLevel: 'info' },
      network: { host: '127.0.0.1' },
      web: { port: 3000 },
      public: { appName: 'Arena Core', defaultLocale: 'fa' },
      server: { apiBaseUrl: 'http://localhost:3001/api/v1' },
    });
    expect(config.warnings).toHaveLength(1);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('keeps database disabled without requiring connection secrets', () => {
    expect(createApiConfig({}, options).database).toEqual({
      enabled: false,
      logQueries: false,
    });
  });

  it('provides bounded authentication defaults and redacts secrets', () => {
    const authentication = createApiConfig({}, options).authentication;
    expect(authentication.password).toMatchObject({
      minLength: 12,
      maxLength: 128,
      algorithm: 'argon2id',
      memoryKiB: 19_456,
      iterations: 2,
      parallelism: 1,
    });
    expect(authentication.session).toMatchObject({
      tokenBytes: 32,
      ttlSeconds: 2_592_000,
      idleTimeoutSeconds: 604_800,
      touchIntervalSeconds: 300,
    });
    expect(authentication.tokenHashKey).toBeInstanceOf(SecretValue);
    expect(JSON.stringify(authentication)).not.toContain('development-only');
  });

  it('validates authentication bounds and key separation without exposing values', () => {
    expect(() =>
      createApiConfig({ PASSWORD_MIN_LENGTH: '40', PASSWORD_MAX_LENGTH: '20' }, options),
    ).toThrow(/PASSWORD_MIN_LENGTH/);
    expect(() => createApiConfig({ SESSION_TOKEN_BYTES: '16' }, options)).toThrow(
      /SESSION_TOKEN_BYTES/,
    );
    expect(() =>
      createApiConfig(
        {
          AUTH_TOKEN_HASH_KEY: 'same-secret-value-that-is-at-least-32-characters',
          AUTH_IP_HASH_KEY: 'same-secret-value-that-is-at-least-32-characters',
        },
        options,
      ),
    ).toThrow(/AUTH_IP_HASH_KEY/);
  });

  it('requires non-placeholder authentication secrets in production', () => {
    const base = {
      NODE_ENV: 'production',
      APP_VERSION: '1',
      LOG_LEVEL: 'info',
      HOST: '127.0.0.1',
      API_PORT: '3001',
      API_PREFIX: '/api/v1',
      CORS_ENABLED: 'false',
      DATABASE_ENABLED: 'false',
    };
    expect(() => createApiConfig(base, options)).toThrow(/AUTH_TOKEN_HASH_KEY/);
    expect(() =>
      createApiConfig(
        {
          ...base,
          AUTH_TOKEN_HASH_KEY: 'development-only-token-hash-key-32-bytes-minimum',
          AUTH_IP_HASH_KEY: 'development-only-ip-hash-key-32-bytes-minimum',
        },
        options,
      ),
    ).toThrow(expect.not.stringContaining('development-only-token'));
  });

  it('requires valid PostgreSQL URLs only when database is enabled', () => {
    expect(() => createApiConfig({ DATABASE_ENABLED: 'true' }, options)).toThrow(/DATABASE_URL/);
    expect(() =>
      createApiConfig(
        {
          DATABASE_ENABLED: 'true',
          DATABASE_URL: 'mysql://example.invalid/db',
          DATABASE_DIRECT_URL: 'contains-a-secret',
        },
        options,
      ),
    ).toThrow(/valid PostgreSQL URL/);
    const config = createApiConfig(
      {
        DATABASE_ENABLED: 'true',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        DATABASE_DIRECT_URL: 'postgresql://user:password@localhost:5432/app',
        DATABASE_LOG_QUERIES: 'true',
      },
      options,
    );
    expect(config.database).toMatchObject({ enabled: true, logQueries: true });
    expect(config.database).toMatchObject({ connectTimeoutSeconds: 5 });
  });

  it('validates the database connection timeout', () => {
    expect(() =>
      createApiConfig(
        {
          DATABASE_ENABLED: 'true',
          DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
          DATABASE_DIRECT_URL: 'postgresql://user:password@localhost:5432/app',
          DATABASE_CONNECT_TIMEOUT_SECONDS: '0',
        },
        options,
      ),
    ).toThrow(/DATABASE_CONNECT_TIMEOUT_SECONDS/);
  });

  it('does not expose database URL values in errors', () => {
    const raw = 'mysql://user:highly-sensitive@example.test/database';
    expect(() =>
      createWorkerConfig(
        { DATABASE_ENABLED: 'true', DATABASE_URL: raw, DATABASE_DIRECT_URL: raw },
        options,
      ),
    ).toThrow(expect.not.stringContaining('highly-sensitive'));
  });

  it('accepts the supported environments', () => {
    for (const environment of ['development', 'test']) {
      expect(createWorkerConfig({ NODE_ENV: environment }, options).runtime.environment).toBe(
        environment,
      );
    }
  });

  it('rejects an unsupported environment', () => {
    expect(() => createWebConfig({ NODE_ENV: 'preview' }, options)).toThrow(/NODE_ENV/);
  });

  it.each(['0', '65536', '12.5', 'abc'])('rejects invalid ports: %s', (port) => {
    expect(() => createApiConfig({ API_PORT: port }, options)).toThrow(/API_PORT/);
  });

  it('accepts only exact boolean spellings', () => {
    expect(createApiConfig({ CORS_ENABLED: 'true' }, options).api.cors.enabled).toBe(true);
    expect(() => createApiConfig({ CORS_ENABLED: 'TRUE' }, options)).toThrow(/CORS_ENABLED/);
  });

  it('normalizes and deduplicates origins', () => {
    const config = createApiConfig(
      { CORS_ENABLED: 'true', CORS_ALLOWED_ORIGINS: 'https://EXAMPLE.com, https://example.com/' },
      options,
    );
    expect(config.api.cors.allowedOrigins).toEqual(['https://example.com']);
  });

  it('rejects origin paths and credentials', () => {
    expect(() =>
      createApiConfig({ CORS_ALLOWED_ORIGINS: 'https://user:pass@example.com/path' }, options),
    ).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it('rejects wildcard origins in production', () => {
    expect(() =>
      createApiConfig(
        {
          ...strictBase,
          API_PORT: '3001',
          API_PREFIX: '/api/v1',
          CORS_ENABLED: 'true',
          CORS_ALLOWED_ORIGINS: '*',
        },
        options,
      ),
    ).toThrow(/wildcard/);
  });

  it('normalizes the API prefix', () => {
    expect(createApiConfig({ API_PREFIX: 'api/v2/' }, options).api.prefix).toBe('/api/v2');
  });

  it('provides secure, bounded identity HTTP defaults', () => {
    const identityHttp = createApiConfig({}, options).identityHttp;
    expect(identityHttp).toMatchObject({
      cookie: {
        name: 'arena_session',
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAgeSeconds: 2_592_000,
      },
      requireOrigin: false,
      maxRequestBodyBytes: 16_384,
    });
  });

  it('rejects invalid cookie and auth-origin configuration', () => {
    expect(() => createApiConfig({ SESSION_COOKIE_NAME: 'bad cookie' }, options)).toThrow(
      /SESSION_COOKIE_NAME/,
    );
    expect(() =>
      createApiConfig({ AUTH_ALLOWED_ORIGINS: 'https://user:pass@example.com/path' }, options),
    ).toThrow(/AUTH_ALLOWED_ORIGINS/);
  });

  it('requires secure cookies and an exact auth origin in production', () => {
    const production = {
      ...strictBase,
      API_PORT: '3001',
      API_PREFIX: '/api/v1',
      CORS_ENABLED: 'false',
      DATABASE_ENABLED: 'false',
      AUTH_TOKEN_HASH_KEY: 'production-token-key-with-at-least-32-characters',
      AUTH_IP_HASH_KEY: 'production-ip-key-with-at-least-32-characters',
    };
    expect(() =>
      createApiConfig({ ...production, SESSION_COOKIE_SECURE: 'false' }, options),
    ).toThrow(/SESSION_COOKIE_SECURE/);
    expect(() => createApiConfig(production, options)).toThrow(/AUTH_ALLOWED_ORIGINS/);
  });

  it('provides disabled Mailpit-compatible email defaults', () => {
    const config = createApiConfig({}, options);
    expect(config.email).toMatchObject({
      enabled: false,
      transport: 'smtp',
      smtp: {
        host: '127.0.0.1',
        port: 1025,
        secure: false,
        connectionTimeoutMs: 5000,
        greetingTimeoutMs: 5000,
        socketTimeoutMs: 10000,
      },
      from: { address: 'no-reply@arena-core.local', name: 'Arena Core' },
    });
    expect(config.identityEmail).toMatchObject({
      publicBaseUrl: 'http://localhost:3000',
      defaultLocale: 'fa',
      verificationPath: '/verify-email',
      passwordResetPath: '/reset-password',
      deliveryRequired: false,
    });
  });

  it('validates SMTP credentials, transport values, links, and paths', () => {
    for (const source of [
      { SMTP_PORT: '0' },
      { SMTP_HOST: 'smtp.example.com:2525' },
      { SMTP_USERNAME: 'user-only' },
      { SMTP_PASSWORD: 'password-only' },
      { SMTP_FROM_ADDRESS: 'invalid-address' },
      { SMTP_CONNECTION_TIMEOUT_MS: '99' },
      { IDENTITY_PUBLIC_BASE_URL: '/relative' },
      { IDENTITY_PUBLIC_BASE_URL: 'https://example.com?token=x' },
      { IDENTITY_EMAIL_VERIFICATION_PATH: '//evil.example/path' },
      { IDENTITY_PASSWORD_RESET_PATH: 'relative' },
      { IDENTITY_EMAIL_DEFAULT_LOCALE: 'de' },
      { IDENTITY_EMAIL_DELIVERY_REQUIRED: 'true', SMTP_ENABLED: 'false' },
    ]) {
      expect(() => createApiConfig(source, options)).toThrow(ConfigurationError);
    }
  });

  it('redacts SMTP passwords', () => {
    const config = createApiConfig(
      {
        SMTP_ENABLED: 'true',
        SMTP_HOST: 'smtp.example.com',
        SMTP_USERNAME: 'mailer',
        SMTP_PASSWORD: 'super-sensitive-smtp-password',
      },
      options,
    );
    expect(config.email.smtp.password?.reveal()).toBe('super-sensitive-smtp-password');
    expect(JSON.stringify(config)).not.toContain('super-sensitive-smtp-password');
    expect(config.email.smtp.password?.toString()).not.toContain('super-sensitive-smtp-password');
  });

  it('rejects an empty API prefix', () => {
    expect(() => createApiConfig({ API_PREFIX: '/' }, options)).toThrow(/API_PREFIX/);
  });

  it('validates public locale and app name', () => {
    expect(() => createWebConfig({ NEXT_PUBLIC_DEFAULT_LOCALE: 'de' }, options)).toThrow(
      /NEXT_PUBLIC_DEFAULT_LOCALE/,
    );
    expect(() => createWebConfig({ NEXT_PUBLIC_APP_NAME: 'x'.repeat(81) }, options)).toThrow(
      /NEXT_PUBLIC_APP_NAME/,
    );
  });

  it('validates the server-only Web API URL without exposing credentials', () => {
    expect(
      createWebConfig({ API_BASE_URL: 'https://api.example.test/api/v1' }, options).server,
    ).toEqual({ apiBaseUrl: 'https://api.example.test/api/v1' });
    expect(() =>
      createWebConfig({ API_BASE_URL: 'https://user:pass@example.test' }, options),
    ).toThrow(/API_BASE_URL/);
    expect(() =>
      createWebConfig(
        { APP_ENV: 'production', NODE_ENV: 'production', API_BASE_URL: 'http://api.example.test' },
        options,
      ),
    ).toThrow(/API_BASE_URL/);
  });

  it('validates worker shutdown bounds', () => {
    expect(() => createWorkerConfig({ WORKER_SHUTDOWN_TIMEOUT_MS: '999' }, options)).toThrow(
      /WORKER_SHUTDOWN_TIMEOUT_MS/,
    );
    expect(createWorkerConfig({ WORKER_SHUTDOWN_TIMEOUT_MS: '2500' }, options).worker).toEqual({
      shutdownTimeoutMs: 2500,
    });
  });

  it('provides bounded server-only matchmaking policy', () => {
    expect(createApiConfig({}, options).matchmaking).toEqual({
      requestTtlSeconds: 900,
      proposalTtlSeconds: 30,
      maxActiveRequestsPerUser: 1,
      maxCandidatesPerEvaluation: 50,
    });
    expect(() =>
      createApiConfig({ MATCHMAKING_MAX_ACTIVE_REQUESTS_PER_USER: '2' }, options),
    ).toThrow(/MATCHMAKING_MAX_ACTIVE_REQUESTS_PER_USER/);
    expect(() =>
      createApiConfig(
        {
          MATCHMAKING_REQUEST_TTL_SECONDS: '60',
          MATCHMAKING_PROPOSAL_TTL_SECONDS: '60',
        },
        options,
      ),
    ).toThrow(/MATCHMAKING_PROPOSAL_TTL_SECONDS/);
  });

  it('provides a bounded server-only match ready deadline', () => {
    expect(createApiConfig({}, options).matches).toEqual({
      readyTtlSeconds: 120,
      entryReservationTtlSeconds: 300,
      settlementDelaySeconds: 86_400,
      resultSubmissionTtlSeconds: 3600,
      resultConflictResolutionTtlSeconds: 86400,
      evidenceSubmissionTtlSeconds: 86400,
      disputeOpenTtlSeconds: 86400,
      disputeResponseTtlSeconds: 86400,
      disputeReviewTtlSeconds: 259200,
    });
    expect(() => createApiConfig({ MATCH_READY_TTL_SECONDS: '10' }, options)).toThrow(
      /MATCH_READY_TTL_SECONDS/,
    );
    expect(() => createApiConfig({ MATCH_ENTRY_RESERVATION_TTL_SECONDS: '10' }, options)).toThrow(
      /MATCH_ENTRY_RESERVATION_TTL_SECONDS/,
    );
  });

  it('requires operational values in staging and production', () => {
    for (const environment of ['staging', 'production']) {
      expect(() => createWorkerConfig({ NODE_ENV: environment }, options)).toThrow(/LOG_LEVEL/);
    }
  });

  it('requires origins when production CORS is enabled', () => {
    expect(() =>
      createApiConfig(
        {
          ...strictBase,
          API_PORT: '3001',
          API_PREFIX: '/api/v1',
          CORS_ENABLED: 'true',
        },
        options,
      ),
    ).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it('fails when the actual runtime is outside the engine range', () => {
    expect(() => createWebConfig({}, { ...options, actualNodeVersion: '23.11.0' })).toThrow(
      /NODE_RUNTIME/,
    );
  });

  it('does not expose raw values in validation errors', () => {
    const secretLikeValue = 'https://alice:highly-sensitive@example.com/path';
    try {
      createApiConfig({ CORS_ALLOWED_ORIGINS: secretLikeValue }, options);
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(String(error)).not.toContain('highly-sensitive');
    }
  });

  it('does not read or mutate process.env when a source is supplied', () => {
    const original = process.env.API_PORT;
    const spy = vi.spyOn(process, 'emitWarning');
    createApiConfig({ API_PORT: '4000' }, options);
    expect(process.env.API_PORT).toBe(original);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

const strictBase = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  HOST: '0.0.0.0',
} as const;
