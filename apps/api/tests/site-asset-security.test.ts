import { afterEach, describe, expect, it } from 'vitest';
import { createApiConfig } from '@arena-core/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { SiteAssetService, inspectSiteAsset } from '../src/admin-operations/site-asset.service';

const roots: string[] = [];
async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'arena-site-assets-'));
  roots.push(root);
  return root;
}
function service(root: string, retention = 300) {
  return new SiteAssetService(
    createApiConfig(
      {
        NODE_ENV: 'test',
        ARENA_SITE_ASSET_ROOT: root,
        ARENA_SITE_ASSET_STAGED_RETENTION_SECONDS: String(retention),
      },
      { packageVersion: '1.0.0', actualNodeVersion: process.versions.node },
    ),
  );
}
async function image(format: 'png' | 'jpeg' | 'webp' = 'png') {
  const pipeline = sharp({ create: { width: 32, height: 32, channels: 4, background: '#3157d5' } });
  return format === 'png'
    ? pipeline.png().toBuffer()
    : format === 'jpeg'
      ? pipeline.jpeg().toBuffer()
      : pipeline.webp().toBuffer();
}
async function ico() {
  const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#3157d5' } })
    .png()
    .toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}
const file = (buffer: Buffer, mimetype = 'image/png', originalname = 'brand.png') => ({
  buffer,
  mimetype,
  originalname,
  size: buffer.byteLength,
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('site asset security', () => {
  it.each([
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ] as const)('accepts a valid %s image whose bytes match its MIME', async (format, mime) => {
    await expect(
      inspectSiteAsset(file(await image(format), mime, `brand.${format}`), 'logoLight'),
    ).resolves.toMatchObject({ mime });
  });

  it('accepts a structurally valid ICO only for the favicon field', async () => {
    const valid = file(await ico(), 'image/x-icon', 'favicon.ico');
    await expect(inspectSiteAsset(valid, 'faviconUrl')).resolves.toMatchObject({
      mime: 'image/x-icon',
      width: 32,
      height: 32,
    });
    for (const field of ['logoLight', 'logoDark', 'openGraphImageUrl', 'heroImageUrl'] as const)
      await expect(inspectSiteAsset(valid, field)).rejects.toThrow(/favicon/);
    await expect(
      inspectSiteAsset(
        file(Buffer.from([0, 0, 1, 0, 1, 0]), 'image/x-icon', 'bad.ico'),
        'faviconUrl',
      ),
    ).rejects.toThrow(/valid ICO/);
  });

  it('rejects fake MIME and invalid magic bytes', async () => {
    await expect(
      inspectSiteAsset(file(await image('png'), 'image/jpeg'), 'logoLight'),
    ).rejects.toThrow(/MIME/);
    await expect(inspectSiteAsset(file(Buffer.from('not an image')), 'logoLight')).rejects.toThrow(
      /valid image/,
    );
  });

  it('rejects oversized payloads and dimensions', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    await expect(inspectSiteAsset(file(oversized), 'logoLight')).rejects.toThrow(/size/);
    const wide = await sharp({
      create: { width: 4097, height: 1, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    await expect(inspectSiteAsset(file(wide), 'logoLight')).rejects.toThrow(/dimensions/);
  });

  it('makes traversal names harmless and rejects SVG or executable content', async () => {
    await expect(
      inspectSiteAsset(file(await image(), 'image/png', '../brand.png'), 'logoLight'),
    ).rejects.toThrow(/filename/);
    await expect(
      inspectSiteAsset(
        file(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'),
          'image/svg+xml',
          'brand.svg',
        ),
        'logoLight',
      ),
    ).rejects.toThrow();
    await expect(
      inspectSiteAsset(
        file(Buffer.from('MZ'), 'application/x-msdownload', 'brand.exe'),
        'logoLight',
      ),
    ).rejects.toThrow();
  });

  it('persists committed assets across service reinitialization and confines paths', async () => {
    const root = await temporaryRoot();
    const first = service(root);
    await first.onModuleInit();
    const staged = await first.stage('actor-1', 'logoLight', file(await image()));
    await first.commitReferenced('actor-1', [staged.url]);
    const second = service(root);
    await second.onModuleInit();
    await expect(second.read(staged.url.split('/').at(-1) ?? '')).resolves.toMatchObject({
      mime: 'image/png',
    });
    await expect(second.read('../outside.png')).rejects.toThrow();
  });

  it('cleans stale staged files but preserves committed references', async () => {
    const root = await temporaryRoot();
    const assets = service(root, 300);
    await assets.onModuleInit();
    const stale = await assets.stage('actor-1', 'logoLight', file(await image()));
    const retained = await assets.stage('actor-1', 'logoDark', file(await image()));
    await assets.commitReferenced('actor-1', [retained.url]);
    expect(await assets.cleanupStaged(Date.now() + 301_000)).toBe(1);
    await expect(assets.read(stale.url.split('/').at(-1) ?? '')).rejects.toThrow();
    await expect(assets.read(retained.url.split('/').at(-1) ?? '')).resolves.toBeDefined();
  });

  it('fails startup clearly when the configured root cannot be used as a directory', async () => {
    const root = await temporaryRoot();
    const fileRoot = join(root, 'not-a-directory');
    await writeFile(fileRoot, 'blocked');
    await expect(service(fileRoot).onModuleInit()).rejects.toThrow(/not writable/);
  });
});
