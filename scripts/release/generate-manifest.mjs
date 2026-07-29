import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileHash, images, migrations, root } from './release-lib.mjs';

const version = process.env.RELEASE_VERSION;
const buildSha = process.env.BUILD_SHA;
const epoch = Number(process.env.SOURCE_DATE_EPOCH);
if (!version || !buildSha || !Number.isInteger(epoch) || epoch < 0) {
  throw new Error(
    'RELEASE_VERSION, BUILD_SHA and a non-negative integer SOURCE_DATE_EPOCH are required.',
  );
}
const tag = `${version}-${buildSha.slice(0, 12)}`;
const manifest = {
  schemaVersion: 1,
  releaseVersion: version,
  buildSha,
  generatedAt: new Date(epoch * 1000).toISOString(),
  nodeVersion: '24.14.0',
  pnpmVersion: '11.9.0',
  lockfileSha256: await fileHash('pnpm-lock.yaml'),
  migrations: await migrations(),
  images: Object.fromEntries(images.map((name) => [name, `arena-${name}:${tag}`])),
};
const output = path.resolve(root, process.argv[2] ?? 'release/manifest.json');
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`Release manifest written: ${path.relative(root, output)}\n`);
