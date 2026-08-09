import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import { mkdtemp, mkdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { closeWithTimeout } from '../dist/graceful-close.js';
import { DatabaseService } from '../dist/database/database.service.js';
import { WorkerHealthService } from '../dist/health/worker-health.service.js';
import { waitForShutdownSignal } from '../dist/shutdown-signal.js';
import { SiteAssetCleanupService } from '../dist/site-assets/site-asset-cleanup.service.js';

function cleanupConfig(root, overrides = {}) {
  return {
    siteAssets: { root, stagedRetentionSeconds: 300 },
    siteAssetCleanup: { enabled: true, intervalSeconds: 60 },
    ...overrides,
  };
}

function cleanupDatabase(settings = null, acquired = true) {
  const transaction = vi.fn(async (operation) =>
    operation({
      $queryRaw: vi.fn(async () => [{ acquired }]),
      siteSettings: { findUnique: vi.fn(async () => settings) },
    }),
  );
  return { getClient: () => ({ $transaction: transaction }), transaction };
}

async function stagedFixture() {
  const root = await mkdtemp(join(tmpdir(), 'arena-worker-assets-'));
  const actor = join(root, '.pending', 'actor');
  await mkdir(actor, { recursive: true });
  const name = '12345678-1234-1234-1234-123456789abc.png';
  const path = join(actor, name);
  await writeFile(path, 'fixture');
  const old = new Date(Date.now() - 600_000);
  await utimes(path, old, old);
  return { root, path, url: `/site-assets/${name}` };
}

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

  it('registers one cleanup interval and does not overlap scheduled runs', async () => {
    vi.useFakeTimers();
    const root = await mkdtemp(join(tmpdir(), 'arena-worker-assets-'));
    await mkdir(join(root, '.pending'), { recursive: true });
    const database = cleanupDatabase();
    const service = new SiteAssetCleanupService(cleanupConfig(root), database);
    service.onModuleInit();
    service.onModuleInit();
    expect(vi.getTimerCount()).toBe(1);
    const first = service.runOnce();
    const second = service.runOnce();
    expect(second).toBe(first);
    await first;
    await service.onModuleDestroy();
    expect(vi.getTimerCount()).toBe(0);
    await rm(root, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it('removes a stale orphan and repeated cleanup remains idempotent', async () => {
    const fixture = await stagedFixture();
    const database = cleanupDatabase();
    const service = new SiteAssetCleanupService(cleanupConfig(fixture.root), database);
    await service.runOnce();
    await expect(stat(fixture.path)).rejects.toThrow();
    await service.runOnce();
    expect(database.transaction).toHaveBeenCalledTimes(2);
    await rm(fixture.root, { recursive: true, force: true });
  });

  it.each(['draft', 'published'])('preserves an asset referenced by %s settings', async (field) => {
    const fixture = await stagedFixture();
    const settings = { draft: {}, published: null, [field]: { image: fixture.url } };
    const service = new SiteAssetCleanupService(
      cleanupConfig(fixture.root),
      cleanupDatabase(settings),
    );
    await service.runOnce();
    await expect(stat(fixture.path)).resolves.toBeDefined();
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('skips cleanup when another replica owns the distributed lock', async () => {
    const fixture = await stagedFixture();
    const service = new SiteAssetCleanupService(
      cleanupConfig(fixture.root),
      cleanupDatabase(null, false),
    );
    await service.runOnce();
    await expect(stat(fixture.path)).resolves.toBeDefined();
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('does not remove non-canonical filenames from the pending root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'arena-worker-assets-'));
    const actor = join(root, '.pending', 'actor');
    await mkdir(actor, { recursive: true });
    const path = join(actor, 'outside.txt');
    await writeFile(path, 'fixture');
    const old = new Date(Date.now() - 600_000);
    await utimes(path, old, old);
    const service = new SiteAssetCleanupService(cleanupConfig(root), cleanupDatabase());
    await service.runOnce();
    await expect(stat(path)).resolves.toBeDefined();
    await rm(root, { recursive: true, force: true });
  });

  it('disabled cleanup registers no timer', async () => {
    vi.useFakeTimers();
    const root = await mkdtemp(join(tmpdir(), 'arena-worker-assets-'));
    const service = new SiteAssetCleanupService(
      cleanupConfig(root, { siteAssetCleanup: { enabled: false, intervalSeconds: 60 } }),
      cleanupDatabase(),
    );
    service.onModuleInit();
    expect(vi.getTimerCount()).toBe(0);
    await service.onModuleDestroy();
    await rm(root, { recursive: true, force: true });
    vi.useRealTimers();
  });
});
