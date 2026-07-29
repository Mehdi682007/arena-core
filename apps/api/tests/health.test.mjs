import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { createApiApplication } from '../dist/bootstrap.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { HealthService } from '../dist/health/health.service.js';

let application;
const runtime = Object.freeze({
  environment: 'test',
  version: '2.3.4',
  logLevel: 'silent',
  nodeVersion: '24.14.0',
});
const config = createApiConfig(
  { NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_ENABLED: 'false' },
  { packageVersion: runtime.version, actualNodeVersion: process.versions.node },
);

afterEach(async () => {
  if (application) {
    await application.close();
    application = undefined;
  }
});

describe('API health', () => {
  it('builds deterministic service health', () => {
    const health = new HealthService(runtime, { getStatus: async () => 'disabled' }).getHealth(
      new Date('2026-01-02T03:04:05.000Z'),
    );

    expect(health).toEqual({
      service: 'api',
      status: 'ok',
      version: '2.3.4',
      environment: 'test',
      timestamp: '2026-01-02T03:04:05.000Z',
    });
  });

  it('serves liveness through the versioned HTTP path', async () => {
    application = await createApiApplication(config, false);
    await application.listen(0, '127.0.0.1');

    const address = application.getHttpServer().address();
    expect(address).toBeTypeOf('object');

    const response = await globalThis.fetch(`http://127.0.0.1:${address.port}/api/v1/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      service: 'api',
      status: 'ok',
      version: '2.3.4',
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    expect(response.headers.get('x-request-id')).toMatch(/^[A-Za-z0-9._-]{8,128}$/);
    expect(response.headers.get('x-correlation-id')).toBe(response.headers.get('x-request-id'));
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('strict-transport-security')).toBeNull();
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('preserves valid request and correlation IDs and replaces control-character values', async () => {
    application = await createApiApplication(config, false);
    await application.listen(0, '127.0.0.1');
    const address = application.getHttpServer().address();
    const preserved = await globalThis.fetch(`http://127.0.0.1:${address.port}/api/v1/health`, {
      headers: { 'x-request-id': 'request_12345', 'x-correlation-id': 'correlation_12345' },
    });
    expect(preserved.headers.get('x-request-id')).toBe('request_12345');
    expect(preserved.headers.get('x-correlation-id')).toBe('correlation_12345');
    const replaced = await globalThis.fetch(`http://127.0.0.1:${address.port}/api/v1/health`, {
      headers: { 'x-request-id': 'short' },
    });
    expect(replaced.headers.get('x-request-id')).not.toBe('short');
  });

  it('enforces exact CORS origins and allows server-to-server requests', async () => {
    const corsConfig = createApiConfig(
      {
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_ENABLED: 'false',
        CORS_ENABLED: 'true',
        ALLOWED_ORIGINS: 'https://web.example',
      },
      { packageVersion: runtime.version, actualNodeVersion: process.versions.node },
    );
    application = await createApiApplication(corsConfig, false);
    await application.listen(0, '127.0.0.1');
    const address = application.getHttpServer().address();
    const allowed = await globalThis.fetch(`http://127.0.0.1:${address.port}/api/v1/health`, {
      headers: { origin: 'https://web.example' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://web.example');
    const denied = await globalThis.fetch(`http://127.0.0.1:${address.port}/api/v1/health`, {
      headers: { origin: 'https://web.example.attacker.invalid' },
    });
    expect(denied.status).toBeGreaterThanOrEqual(400);
    const noOrigin = await globalThis.fetch(`http://127.0.0.1:${address.port}/api/v1/health`);
    expect(noOrigin.status).toBe(200);
  });

  it('reports disabled database readiness without exposing configuration', async () => {
    application = await createApiApplication(config, false);
    await application.listen(0, '127.0.0.1');
    const address = application.getHttpServer().address();
    const response = await globalThis.fetch(`http://127.0.0.1:${address.port}/api/v1/health/ready`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      service: 'api',
      status: 'ready',
      dependencies: { database: 'disabled' },
    });
    expect(JSON.stringify(body)).not.toContain('postgresql://');
  });

  it('returns a safe service-unavailable error for identity when database is disabled', async () => {
    application = await createApiApplication(config, false);
    await application.listen(0, '127.0.0.1');
    const address = application.getHttpServer().address();
    const response = await globalThis.fetch(
      `http://127.0.0.1:${address.port}/api/v1/auth/register`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'player@example.com',
          password: 'a sufficiently long password',
        }),
      },
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      error: { code: 'IDENTITY_SERVICE_UNAVAILABLE' },
    });
    expect(JSON.stringify(body)).not.toContain('Prisma');
    expect(JSON.stringify(body)).not.toContain('a sufficiently long password');
  });

  it('connects, probes, and disconnects an enabled client', async () => {
    const client = {
      $connect: vi.fn(async () => undefined),
      $disconnect: vi.fn(async () => undefined),
      $queryRaw: vi.fn(async () => [{ value: 1 }]),
    };
    const enabled = {
      ...config,
      database: {
        enabled: true,
        url: 'postgresql://redacted.invalid/db',
        directUrl: 'postgresql://redacted.invalid/db',
        logQueries: false,
      },
    };
    const database = new DatabaseService(enabled, () => client);
    await database.onModuleInit();
    expect(await database.getStatus()).toBe('up');
    await database.onModuleDestroy();
    await database.onModuleDestroy();
    expect(client.$connect).toHaveBeenCalledOnce();
    expect(client.$disconnect).toHaveBeenCalledOnce();
  });
});
