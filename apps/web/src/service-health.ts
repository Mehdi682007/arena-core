import type { RuntimeConfig } from '@arena-core/config';
import type { HttpServiceHealth } from '@arena-core/contracts';

export function buildWebHealth(runtime: RuntimeConfig, now: Date = new Date()): HttpServiceHealth {
  return {
    service: 'web',
    status: 'ok',
    version: runtime.version,
    environment: runtime.environment,
    timestamp: now.toISOString(),
  };
}
