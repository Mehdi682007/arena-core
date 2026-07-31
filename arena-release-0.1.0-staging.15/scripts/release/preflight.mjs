import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { root } from './release-lib.mjs';

const mode = process.argv.includes('--full') ? 'full' : 'static';
const required = [
  '.dockerignore',
  'docker/Dockerfile',
  'infra/compose/compose.production.yml',
  'infra/compose/compose.staging.yml',
  'release/manifest.json',
  '.github/workflows/release-verify.yml',
];
for (const file of required) await access(path.join(root, file));
const dockerfile = await readFile(path.join(root, 'docker/Dockerfile'), 'utf8');
if (
  !dockerfile.includes('node:24.14.0-bookworm-slim') ||
  !dockerfile.includes('pnpm install --frozen-lockfile')
) {
  throw new Error('Pinned runtime or frozen dependency installation is missing.');
}
if (/\b(latest|privileged|network_mode:\s*host)\b/i.test(dockerfile)) {
  throw new Error('Unsafe container policy detected.');
}
if (mode === 'full') {
  const result = spawnSync('docker', ['compose', 'version'], { stdio: 'inherit', shell: false });
  if (result.status !== 0) throw new Error('Docker Compose runtime/config validation is blocked.');
}
process.stdout.write(`Deployment preflight (${mode}): pass\n`);
