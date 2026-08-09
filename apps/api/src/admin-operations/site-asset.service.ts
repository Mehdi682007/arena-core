import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import type { ApiServiceConfig } from '@arena-core/config';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { API_CONFIG } from '../config/config.module';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 4096;
const MAX_PIXELS = 16_000_000;
const formats = new Map<string, { mime: string; extension: string }>([
  ['png', { mime: 'image/png', extension: '.png' }],
  ['jpeg', { mime: 'image/jpeg', extension: '.jpg' }],
  ['webp', { mime: 'image/webp', extension: '.webp' }],
] as const);

export type SiteAssetField =
  'logoLight' | 'logoDark' | 'faviconUrl' | 'openGraphImageUrl' | 'heroImageUrl';
export type SiteAssetFile = Readonly<{
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}>;

function inspectIco(file: SiteAssetFile, field: SiteAssetField) {
  if (field !== 'faviconUrl') throw new BadRequestException('ICO is allowed only for favicon.');
  if (!['image/x-icon', 'image/vnd.microsoft.icon'].includes(file.mimetype))
    throw new BadRequestException('Asset MIME does not match its content.');
  if (
    file.buffer.length < 22 ||
    file.buffer.readUInt16LE(0) !== 0 ||
    file.buffer.readUInt16LE(2) !== 1
  )
    throw new BadRequestException('Asset content is not a valid ICO image.');
  const count = file.buffer.readUInt16LE(4);
  if (count < 1 || count > 16 || file.buffer.length < 6 + count * 16)
    throw new BadRequestException('Asset content is not a valid ICO image.');
  let width = 0;
  let height = 0;
  let pixels = 0;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const itemWidth = file.buffer[entry] === 0 ? 256 : (file.buffer[entry] ?? 0);
    const itemHeight = file.buffer[entry + 1] === 0 ? 256 : (file.buffer[entry + 1] ?? 0);
    const bytes = file.buffer.readUInt32LE(entry + 8);
    const offset = file.buffer.readUInt32LE(entry + 12);
    if (!bytes || offset < 6 + count * 16 || offset + bytes > file.buffer.length)
      throw new BadRequestException('Asset content is not a valid ICO image.');
    width = Math.max(width, itemWidth);
    height = Math.max(height, itemHeight);
    pixels += itemWidth * itemHeight;
  }
  if (width > MAX_EDGE || height > MAX_EDGE || pixels > MAX_PIXELS)
    throw new BadRequestException('Asset dimensions are invalid.');
  return { mime: 'image/x-icon', extension: '.ico', width, height };
}

export async function inspectSiteAsset(file: SiteAssetFile, field: SiteAssetField) {
  if (file.size < 1 || file.size > MAX_BYTES || file.buffer.byteLength !== file.size)
    throw new BadRequestException('Asset size is invalid.');
  if (basename(file.originalname) !== file.originalname || /[\\/\0]/.test(file.originalname))
    throw new BadRequestException('Asset filename is invalid.');
  if (file.buffer.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return inspectIco(file, field);
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(file.buffer, {
      limitInputPixels: MAX_PIXELS,
      failOn: 'error',
    }).metadata();
  } catch {
    throw new BadRequestException('Asset content is not a valid image.');
  }
  const policy = formats.get(metadata.format);
  if (!policy || file.mimetype !== policy.mime)
    throw new BadRequestException('Asset MIME does not match its content.');
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_EDGE ||
    metadata.height > MAX_EDGE ||
    metadata.width * metadata.height > MAX_PIXELS ||
    (metadata.pages ?? 1) > 1
  )
    throw new BadRequestException('Asset dimensions are invalid.');
  return { ...policy, width: metadata.width, height: metadata.height };
}

@Injectable()
export class SiteAssetService implements OnModuleInit {
  private readonly root: string;
  private readonly pendingRoot: string;
  private readonly retentionMs: number;
  private mutationTail: Promise<void> = Promise.resolve();

  public constructor(@Inject(API_CONFIG) config: ApiServiceConfig) {
    this.root = resolve(config.siteAssets.root);
    this.pendingRoot = this.path('.pending');
    this.retentionMs = config.siteAssets.stagedRetentionSeconds * 1000;
  }

  public async onModuleInit(): Promise<void> {
    try {
      await mkdir(this.pendingRoot, { recursive: true, mode: 0o750 });
      await access(this.root, constants.R_OK | constants.W_OK);
    } catch {
      throw new ServiceUnavailableException('Persistent site asset storage is not writable.');
    }
  }

  private path(...segments: readonly string[]): string {
    const candidate = resolve(this.root, ...segments);
    if (candidate !== this.root && !candidate.startsWith(`${this.root}${sep}`))
      throw new BadRequestException('Asset path escapes the configured root.');
    return candidate;
  }

  public async withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationTail;
    let release = (): void => undefined;
    this.mutationTail = new Promise<void>((resolveLock) => {
      release = resolveLock;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  public async stage(actorUserId: string, field: SiteAssetField, file: SiteAssetFile) {
    const inspected = await inspectSiteAsset(file, field);
    const id = `${randomUUID()}${inspected.extension}`;
    const directory = this.path('.pending', actorUserId);
    await mkdir(directory, { recursive: true, mode: 0o750 });
    await writeFile(this.path('.pending', actorUserId, id), file.buffer, {
      flag: 'wx',
      mode: 0o640,
    });
    return {
      url: `/site-assets/${id}`,
      width: inspected.width,
      height: inspected.height,
      mime: inspected.mime,
    };
  }

  public async commitReferenced(
    actorUserId: string,
    urls: readonly string[],
  ): Promise<readonly string[]> {
    const committed: string[] = [];
    for (const url of new Set(urls.filter((item) => item.startsWith('/site-assets/')))) {
      const id = basename(url);
      if (url !== `/site-assets/${id}` || !/^[-a-f0-9]{36}\.(png|jpg|webp|ico)$/.test(id))
        throw new BadRequestException('Asset URL is invalid.');
      const source = this.path('.pending', actorUserId, id);
      const destination = this.path(id);
      try {
        await rename(source, destination);
        committed.push(destination);
      } catch (error) {
        const exists = await stat(destination)
          .then(() => true)
          .catch(() => false);
        if (!exists) throw error;
      }
    }
    return committed;
  }

  public async rollbackCommitted(paths: readonly string[]) {
    await Promise.all(
      paths.map(async (path) => {
        if (relative(this.root, resolve(path)).startsWith('..')) return;
        await rm(path, { force: true });
      }),
    );
  }

  public async cleanupStaged(now = Date.now()): Promise<number> {
    const actorDirectories = await readdir(this.pendingRoot, { withFileTypes: true }).catch(
      () => [],
    );
    let removed = 0;
    for (const actor of actorDirectories) {
      if (!actor.isDirectory()) continue;
      const directory = this.path('.pending', actor.name);
      const files = await readdir(directory, { withFileTypes: true }).catch(() => []);
      for (const file of files) {
        if (!file.isFile()) continue;
        const path = this.path('.pending', actor.name, file.name);
        const metadata = await stat(path).catch(() => undefined);
        if (metadata && now - metadata.mtimeMs >= this.retentionMs) {
          await rm(path, { force: true }).catch(() => undefined);
          removed += 1;
        }
      }
      await rm(directory, { recursive: false }).catch(() => undefined);
    }
    return removed;
  }

  public async deleteUnreferenced(
    urls: readonly string[],
    referenced: ReadonlySet<string>,
  ): Promise<number> {
    let removed = 0;
    for (const url of new Set(urls)) {
      if (referenced.has(url) || !url.startsWith('/site-assets/')) continue;
      const id = basename(url);
      if (url !== `/site-assets/${id}` || !/^[-a-f0-9]{36}\.(png|jpg|webp|ico)$/.test(id)) continue;
      await rm(this.path(id), { force: true });
      removed += 1;
    }
    return removed;
  }

  public async cleanupCommitted(referenced: ReadonlySet<string>): Promise<number> {
    const files = await readdir(this.root, { withFileTypes: true }).catch(() => []);
    const candidates = files
      .filter((file) => file.isFile() && /^[-a-f0-9]{36}\.(png|jpg|webp|ico)$/.test(file.name))
      .map((file) => `/site-assets/${file.name}`);
    return this.deleteUnreferenced(candidates, referenced);
  }

  public async read(id: string) {
    if (basename(id) !== id || !/^[-a-f0-9]{36}\.(png|jpg|webp|ico)$/.test(id))
      throw new NotFoundException();
    const path = this.path(id);
    const buffer = await readFile(path).catch(() => {
      throw new NotFoundException();
    });
    const extension = extname(id);
    const mime =
      extension === '.png'
        ? 'image/png'
        : extension === '.jpg'
          ? 'image/jpeg'
          : extension === '.webp'
            ? 'image/webp'
            : 'image/x-icon';
    return { buffer, mime };
  }
}
