import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { closeWithTimeout } from '../dist/graceful-close.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { WorkerHealthService } from '../dist/health/worker-health.service.js';
import { waitForShutdownSignal } from '../dist/shutdown-signal.js';

describe('worker foundation', () => {
  it('returns a valid internal health snapshot', () => {
    const health = new WorkerHealthService(
      {
        environment: 'test',
        version: '3.4.5',
        logLevel: 'silent',
        nodeVersion: '24.14.0',
      },
      { getStatus: () => 'disabled' },
    ).getSnapshot();

    expect(health).toMatchObject({
      service: 'worker',
      status: 'ok',
      version: '3.4.5',
      environment: 'test',
      database: 'disabled',
    });
    expect(new Date(health.startedAt).toISOString()).toBe(health.startedAt);
  });

  it('does not create a client while database is disabled', async () => {
    const factory = vi.fn();
    const database = new DatabaseService(
      { database: { enabled: false, logQueries: false } },
      factory,
    );
    await database.onModuleInit();
    await database.onModuleDestroy();
    expect(factory).not.toHaveBeenCalled();
    expect(database.getStatus()).toBe('disabled');
  });

  it('connects and disconnects an enabled client once', async () => {
    const client = {
      $connect: vi.fn(async () => undefined),
      $disconnect: vi.fn(async () => undefined),
      $queryRaw: vi.fn(async () => [{ value: 1 }]),
    };
    const database = new DatabaseService(
      {
        database: {
          enabled: true,
          url: 'postgresql://redacted.invalid/db',
          directUrl: 'postgresql://redacted.invalid/db',
          logQueries: false,
        },
      },
      () => client,
    );
    await database.onModuleInit();
    await database.onModuleDestroy();
    await database.onModuleDestroy();
    expect(client.$connect).toHaveBeenCalledOnce();
    expect(client.$disconnect).toHaveBeenCalledOnce();
  });

  it('resolves once and cleans up both signal listeners', async () => {
    const source = new EventEmitter();
    const shutdown = waitForShutdownSignal(source);

    expect(source.listenerCount('SIGINT')).toBe(1);
    expect(source.listenerCount('SIGTERM')).toBe(1);

    source.emit('SIGTERM');

    await expect(shutdown).resolves.toBe('SIGTERM');
    expect(source.listenerCount('SIGINT')).toBe(0);
    expect(source.listenerCount('SIGTERM')).toBe(0);
  });

  it('clears its shutdown timeout after a clean close', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await closeWithTimeout(async () => undefined, 1000);
    expect(clearSpy).toHaveBeenCalledOnce();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });

  it('fails when graceful close exceeds its deadline', async () => {
    vi.useFakeTimers();
    const close = closeWithTimeout(() => new Promise(() => undefined), 1000);
    const assertion = expect(close).rejects.toThrow(/shutdown exceeded/);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });
});
