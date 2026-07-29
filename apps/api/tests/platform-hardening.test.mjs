import { describe, expect, it } from 'vitest';
import { redactSensitive } from '../dist/platform/redaction.js';
import { requestContext, validOpaqueId } from '../dist/platform/request-context.js';
import { InMemoryMetrics, NoopMetrics } from '../dist/platform/metrics.js';
import { StructuredLogger } from '../dist/platform/structured-logger.js';

describe('platform redaction', () => {
  it('redacts nested secrets, arrays, URLs, errors, circular values and BigInt without mutation', () => {
    const original = {
      password: 'visible',
      nested: [{ databaseUrl: 'postgresql://user:pass@db/private?token=abc' }],
      count: 2n,
      error: new Error('failed postgresql://user:pass@db/private?secret=abc'),
    };
    original.circular = original;
    const output = redactSensitive(original);
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain('visible');
    expect(serialized).not.toContain('pass@');
    expect(serialized).not.toContain('abc');
    expect(serialized).toContain('[CIRCULAR]');
    expect(original.password).toBe('visible');
  });

  it('ignores prototype-pollution keys', () => {
    const input = JSON.parse('{"safe":1,"__proto__":{"polluted":true}}');
    expect(redactSensitive(input)).toEqual({ safe: 1 });
  });
});

describe('request context', () => {
  it('validates bounded opaque IDs and isolates concurrent async work', async () => {
    expect(validOpaqueId('safe-id_123')).toBe(true);
    expect(validOpaqueId('bad\nid-123')).toBe(false);
    const values = await Promise.all(
      ['request-a', 'request-b'].map((requestId) =>
        requestContext.run({ requestId, correlationId: requestId }, async () => {
          await Promise.resolve();
          return requestContext.get()?.requestId;
        }),
      ),
    );
    expect(values).toEqual(['request-a', 'request-b']);
    expect(requestContext.get()).toBeUndefined();
  });
});

describe('structured logging and metrics', () => {
  it('adds context and never logs secret fields', () => {
    const lines = [];
    const logger = new StructuredLogger('api', 'test', (line) => lines.push(line));
    requestContext.run({ requestId: 'request-1', correlationId: 'correlation-1' }, () =>
      logger.write('info', 'completed', 'HTTP', { password: 'do-not-log', statusCode: 200 }),
    );
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      service: 'api',
      requestId: 'request-1',
      statusCode: 200,
      password: '[REDACTED]',
    });
    expect(lines[0]).not.toContain('do-not-log');
  });

  it('supports no-op and test metrics while rejecting high-cardinality labels', () => {
    const metrics = new InMemoryMetrics();
    metrics.increment('http_requests_total', { route: 'health', status: '200' });
    metrics.observe('http_request_duration_ms', 4, { route: 'health' });
    expect(metrics.snapshot()).toHaveLength(2);
    expect(() => metrics.increment('bad', { userId: '123' })).toThrow();
    expect(new NoopMetrics().snapshot()).toEqual([]);
  });
});
