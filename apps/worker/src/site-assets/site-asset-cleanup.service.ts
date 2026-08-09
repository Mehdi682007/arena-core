import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { WorkerServiceConfig } from '@arena-core/config';
import { readdir, rm, stat } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { WORKER_CONFIG } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

const LOCK_ID = 7_410_326_006;
const ASSET_URL = /^\/site-assets\/[-a-f0-9]{36}\.(?:png|jpg|webp|ico)$/;

function collectReferences(value: unknown, output: Set<string>): void {
  if (typeof value === 'string') {
    if (ASSET_URL.test(value)) output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, output);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectReferences(item, output);
  }
}

@Injectable()
export class SiteAssetCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SiteAssetCleanupService.name);
  private readonly root: string;
  private readonly pendingRoot: string;
  private readonly retentionMs: number;
  private readonly intervalMs: number;
  private readonly enabled: boolean;
  private timer: NodeJS.Timeout | undefined;
  private active: Promise<void> | undefined;

  public constructor(
    @Inject(WORKER_CONFIG) config: WorkerServiceConfig,
    private readonly database: DatabaseService,
  ) {
    this.root = resolve(config.siteAssets.root);
    this.pendingRoot = this.insideRoot('.pending');
    this.retentionMs = config.siteAssets.stagedRetentionSeconds * 1000;
    this.intervalMs = config.siteAssetCleanup.intervalSeconds * 1000;
    this.enabled = config.siteAssetCleanup.enabled;
  }

  public onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log(JSON.stringify({ event: 'site_asset_cleanup.disabled' }));
      return;
    }
    if (this.timer) return;
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
    void this.runOnce();
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.active;
  }

  public runOnce(now = Date.now()): Promise<void> {
    if (this.active) return this.active;
    this.active = this.cleanup(now)
      .catch((error: unknown) => {
        this.logger.error(
          JSON.stringify({
            event: 'site_asset_cleanup.failed',
            error: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
      })
      .finally(() => {
        this.active = undefined;
      });
    return this.active;
  }

  private insideRoot(...segments: readonly string[]): string {
    const candidate = resolve(this.root, ...segments);
    if (candidate !== this.root && !candidate.startsWith(`${this.root}${sep}`))
      throw new Error('Site asset cleanup path escapes the configured root.');
    return candidate;
  }

  private async cleanup(now: number): Promise<void> {
    const client = this.database.getClient();
    if (!client) return;
    await client.$transaction(async (tx) => {
      const lock = await tx.$queryRaw<readonly { acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${LOCK_ID}) AS acquired
      `;
      if (!lock[0]?.acquired) return;
      const settings = await tx.siteSettings.findUnique({
        where: { id: 'primary' },
        select: { draft: true, published: true },
      });
      const references = new Set<string>();
      if (settings) {
        collectReferences(settings.draft, references);
        collectReferences(settings.published, references);
      }
      let removed = 0;
      const actors = await readdir(this.pendingRoot, { withFileTypes: true }).catch(() => []);
      for (const actor of actors) {
        if (!actor.isDirectory()) continue;
        const directory = this.insideRoot('.pending', actor.name);
        const files = await readdir(directory, { withFileTypes: true }).catch(() => []);
        for (const file of files) {
          if (!file.isFile()) continue;
          const url = `/site-assets/${basename(file.name)}`;
          if (!ASSET_URL.test(url) || references.has(url)) continue;
          const candidate = this.insideRoot('.pending', actor.name, file.name);
          const metadata = await stat(candidate).catch(() => undefined);
          if (!metadata || now - metadata.mtimeMs < this.retentionMs) continue;
          try {
            await rm(candidate, { force: true });
            removed += 1;
          } catch {
            this.logger.warn(JSON.stringify({ event: 'site_asset_cleanup.file_failed' }));
          }
        }
        await rm(directory, { recursive: false }).catch(() => undefined);
      }
      this.logger.log(JSON.stringify({ event: 'site_asset_cleanup.completed', removed }));
    });
  }
}
