import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileHash, images, migrations, root } from './release-lib.mjs';

const manifestPath = path.resolve(root, process.argv[2] ?? 'release/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const fail = (message) => {
  throw new Error(`Artifact verification failed: ${message}`);
};
if (manifest.schemaVersion !== 1) fail('unsupported manifest schema');
if (manifest.buildSha !== 'uncommitted' && !/^[0-9a-f]{7,64}$/i.test(manifest.buildSha))
  fail('invalid build SHA');
if (Number.isNaN(Date.parse(manifest.generatedAt))) fail('invalid timestamp');
if (manifest.lockfileSha256 !== (await fileHash('pnpm-lock.yaml'))) fail('lockfile drift');
if (JSON.stringify(manifest.migrations) !== JSON.stringify(await migrations()))
  fail('migration drift');
for (const image of images) {
  const reference = manifest.images?.[image];
  if (
    !reference ||
    reference.endsWith(':latest') ||
    !reference.includes(manifest.buildSha.slice(0, 12))
  ) {
    fail(`image ${image} is not immutable`);
  }
}
process.stdout.write('Release artifacts verified.\n');
