import { describe, expect, it } from 'vitest';
import {
  ProductionConfigurationError,
  configFingerprint,
  createProductionHardeningConfig,
  normalizeOrigins,
} from '../src/production-hardening';

const production = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  APP_BASE_URL: 'https://arena.example',
  API_BASE_URL: 'https://api.arena.example',
  WEB_BASE_URL: 'https://arena.example',
  SESSION_SECRET: 's'.repeat(48),
  CSRF_SECRET: 'c'.repeat(48),
  ALLOWED_ORIGINS: 'https://arena.example, https://admin.arena.example/',
  COOKIE_SECURE: 'true',
  DATABASE_ENABLED: 'true',
  RATE_LIMIT_ENABLED: 'true',
  MIGRATION_MODE: 'external',
};

describe('production hardening configuration', () => {
  it.each([
    ['local', 'development'],
    ['test', 'test'],
    ['staging', 'production'],
    ['production', 'production'],
  ] as const)('maps APP_ENV=%s to NODE_ENV=%s', (app, node) => {
    const source = app === 'staging' || app === 'production' ? { ...production } : {};
    const config = createProductionHardeningConfig({
      ...source,
      APP_ENV: app,
      NODE_ENV: node,
      ...(app === 'staging' ? { DATABASE_ENABLED: 'true' } : {}),
    });
    expect(config.environment).toBe(app);
    expect(config.nodeEnvironment).toBe(node);
  });

  it('normalizes and deduplicates exact origins', () => {
    expect(normalizeOrigins('https://a.example/, https://a.example,https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it.each([
    ['missing secret', { SESSION_SECRET: undefined }],
    ['default secret', { SESSION_SECRET: 'secret' }],
    ['localhost URL', { API_BASE_URL: 'https://localhost' }],
    ['insecure URL', { WEB_BASE_URL: 'http://arena.example' }],
    ['wildcard CORS', { ALLOWED_ORIGINS: '*' }],
    ['insecure cookie', { COOKIE_SECURE: 'false' }],
    ['disabled limiter', { RATE_LIMIT_ENABLED: 'false' }],
    ['invalid timeout', { HTTP_REQUEST_TIMEOUT_MS: '0' }],
    ['invalid migration mode', { MIGRATION_MODE: 'automatic' }],
  ])('fails fast and redacts values for %s', (_name, override) => {
    expect(() => createProductionHardeningConfig({ ...production, ...override })).toThrow(
      ProductionConfigurationError,
    );
    try {
      createProductionHardeningConfig({ ...production, ...override });
    } catch (error) {
      expect(String(error)).not.toContain(String(Object.values(override)[0]));
    }
  });

  it('creates a stable non-sensitive fingerprint', () => {
    const config = createProductionHardeningConfig(production);
    const fingerprint = configFingerprint(config, { databaseEnabled: true });
    expect(fingerprint).toMatchObject({ environment: 'production', allowedOriginCount: 2 });
    expect(JSON.stringify(fingerprint)).not.toContain(production.SESSION_SECRET);
    expect(Object.isFrozen(config)).toBe(true);
  });
});
