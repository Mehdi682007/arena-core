import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const composeArguments = [
  'compose',
  '--project-directory',
  '.',
  '-f',
  'infra/compose/docker-compose.yml',
];
const requiredServices = ['postgres', 'redis', 'minio', 'mailpit'];

export function parseComposeStatus(output) {
  const trimmed = output.trim();
  if (!trimmed) return [];

  try {
    const value = JSON.parse(trimmed);
    return Array.isArray(value) ? value : [value];
  } catch {
    return trimmed
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

export function assessStatus(entries) {
  const failures = [];
  const results = [];

  for (const service of requiredServices) {
    const entry = entries.find((candidate) => candidate.Service === service);
    const healthy = entry?.State === 'running' && entry.Health === 'healthy';
    results.push(`${displayName(service)}: ${healthy ? 'healthy' : 'not healthy'}`);
    if (!healthy) failures.push(service);
  }

  const init = entries.find((candidate) => candidate.Service === 'minio-init');
  const bucketReady = init?.State === 'exited' && Number(init.ExitCode) === 0;
  results.push(`MinIO bucket: ${bucketReady ? 'ready' : 'not ready'}`);
  if (!bucketReady) failures.push('minio-init');

  return { failures, results };
}

function displayName(service) {
  return (
    {
      postgres: 'PostgreSQL',
      redis: 'Redis',
      minio: 'MinIO',
      mailpit: 'Mailpit',
    }[service] ?? service
  );
}

function docker(args) {
  return spawnSync('docker', [...composeArguments, ...args], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
}

function status() {
  const result = docker(['ps', '--all', '--format', 'json']);
  if (result.error) throw new Error(`Docker command failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error('Docker Compose status command failed.');
  return assessStatus(parseComposeStatus(result.stdout));
}

async function main() {
  const deadline = Date.now() + 120_000;
  let assessment;

  do {
    assessment = status();
    if (assessment.failures.length === 0) break;
    await delay(1_000);
  } while (Date.now() < deadline);

  for (const line of assessment.results) process.stdout.write(`${line}\n`);
  if (assessment.failures.length > 0) {
    process.stderr.write(`Infrastructure health failed: ${assessment.failures.join(', ')}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Health check failed.'}\n`);
    process.exitCode = 1;
  });
}
