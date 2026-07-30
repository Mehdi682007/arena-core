import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
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
    vi.useFakeTimers();
    const source = new EventEmitter();
    const shutdown = waitForShutdownSignal(source);

    expect(source.listenerCount('SIGINT')).toBe(1);
    expect(source.listenerCount('SIGTERM')).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    source.emit('SIGTERM');

    await expect(shutdown).resolves.toBe('SIGTERM');
    expect(source.listenerCount('SIGINT')).toBe(0);
    expect(source.listenerCount('SIGTERM')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('remains a single running daemon for 60 seconds and exits cleanly on supervisor SIGTERM', async () => {
    const child = spawn(process.execPath, ['dist/main.js'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        APP_ENV: 'test',
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
        DATABASE_ENABLED: 'false',
        WORKER_SHUTDOWN_TIMEOUT_MS: '10000',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const exited = once(child, 'exit');

    try {
      await Promise.race([
        delay(60_000),
        exited.then(([code, signal]) => {
          throw new Error(`Worker exited early: code=${code} signal=${signal}\n${output}`);
        }),
      ]);

      expect(child.exitCode).toBeNull();
      expect(child.signalCode).toBeNull();
      expect(output.match(/"event":"worker.started"/g)).toHaveLength(1);

      child.send('shutdown:SIGTERM');
      const [code, signal] = await Promise.race([
        exited,
        delay(10_000).then(() => {
          throw new Error('Worker did not stop after SIGTERM.');
        }),
      ]);
      expect(code).toBe(0);
      expect(signal).toBeNull();
      expect(output.match(/"event":"worker.stopping","signal":"SIGTERM"/g)).toHaveLength(1);
      expect(output.match(/"event":"worker.stopped"/g)).toHaveLength(1);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    }
  }, 75_000);

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
