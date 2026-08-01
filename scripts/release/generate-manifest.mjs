import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileHash, migrations, root } from './release-lib.mjs';

const version = process.env.RELEASE_VERSION;
const buildSha = process.env.BUILD_SHA;
const epoch = Number(process.env.SOURCE_DATE_EPOCH);

if (!version || !buildSha || !Number.isInteger(epoch) || epoch < 0) {
  throw new Error(
    'RELEASE_VERSION, BUILD_SHA and a non-negative integer SOURCE_DATE_EPOCH are required.',
  );
}

const deploymentImagesPath = path.resolve(root, 'release/deployment-images.json');

const deploymentImages = JSON.parse(await readFile(deploymentImagesPath, 'utf8'));

if (deploymentImages.schemaVersion !== 1 || deploymentImages.sourceCommit !== buildSha) {
  throw new Error('deployment-images.json does not match release build SHA');
}

const imageReferences = Object.fromEntries(
  Object.entries(deploymentImages.images).map(([name, image]) => [name, image.reference]),
);

const manifest = {
  schemaVersion: 1,
  releaseVersion: version,
  buildSha,
  generatedAt: new Date(epoch * 1000).toISOString(),
  nodeVersion: '24.14.0',
  pnpmVersion: '11.9.0',
  lockfileSha256: await fileHash('pnpm-lock.yaml'),
  migrations: await migrations(),
  images: imageReferences,
};

const output = path.resolve(root, process.argv[2] ?? 'release/manifest.json');

await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });

process.stdout.write(`Release manifest written: ${path.relative(root, output)}\n`);
