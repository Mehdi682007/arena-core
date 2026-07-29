import { describe, expect, it } from 'vitest';
import { createWebConfig } from '@arena-core/config';
import { buildWebHealth } from '../src/service-health';

describe('buildWebHealth', () => {
  it('creates deterministic, non-sensitive health metadata', () => {
    const config = createWebConfig(
      { APP_VERSION: '1.2.3', NODE_ENV: 'test' },
      { packageVersion: '0.0.0', actualNodeVersion: '24.14.0' },
    );
    const health = buildWebHealth(config.runtime, new Date('2026-01-02T03:04:05.000Z'));

    expect(health).toEqual({
      service: 'web',
      status: 'ok',
      version: '1.2.3',
      environment: 'test',
      timestamp: '2026-01-02T03:04:05.000Z',
    });
  });
});
