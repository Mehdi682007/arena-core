import assert from 'node:assert/strict';
import test from 'node:test';
import { assessStatus, parseComposeStatus } from './health.mjs';

const healthyEntries = [
  { Service: 'postgres', State: 'running', Health: 'healthy' },
  { Service: 'redis', State: 'running', Health: 'healthy' },
  { Service: 'minio', State: 'running', Health: 'healthy' },
  { Service: 'mailpit', State: 'running', Health: 'healthy' },
  { Service: 'minio-init', State: 'exited', ExitCode: 0 },
];

test('parses JSON arrays and newline-delimited Compose output', () => {
  assert.deepEqual(parseComposeStatus(JSON.stringify(healthyEntries)), healthyEntries);
  assert.deepEqual(
    parseComposeStatus(healthyEntries.map((entry) => JSON.stringify(entry)).join('\n')),
    healthyEntries,
  );
});

test('accepts actual healthy state including successful one-shot initialization', () => {
  const assessment = assessStatus(healthyEntries);
  assert.deepEqual(assessment.failures, []);
  assert.match(assessment.results.at(-1), /ready$/);
});

test('rejects running services without a healthy healthcheck', () => {
  const entries = healthyEntries.map((entry) =>
    entry.Service === 'redis' ? { ...entry, Health: 'unhealthy' } : entry,
  );
  assert.deepEqual(assessStatus(entries).failures, ['redis']);
});

test('rejects missing or failed MinIO initialization', () => {
  assert.deepEqual(
    assessStatus(healthyEntries.filter((entry) => entry.Service !== 'minio-init')).failures,
    ['minio-init'],
  );
  const failed = healthyEntries.map((entry) =>
    entry.Service === 'minio-init' ? { ...entry, ExitCode: 1 } : entry,
  );
  assert.deepEqual(assessStatus(failed).failures, ['minio-init']);
});
