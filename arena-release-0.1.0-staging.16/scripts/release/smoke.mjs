import process from 'node:process';

/* global AbortSignal, fetch */

const api = process.env.SMOKE_API_URL;
const web = process.env.SMOKE_WEB_URL;
if (!api || !web) throw new Error('SMOKE_API_URL and SMOKE_WEB_URL are required.');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 5_000);
const retries = Number(process.env.SMOKE_RETRIES ?? 3);
const probes = [
  ['api liveness', `${api}/api/v1/health`],
  ['api readiness', `${api}/api/v1/health/ready`],
  ['web health', `${web}/health`],
];
for (const [name, url] of probes) {
  let response;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
      if (response.ok) break;
    } catch {
      if (attempt === retries) throw new Error(`${name} did not respond.`);
    }
  }
  if (!response?.ok) throw new Error(`${name} returned ${response?.status ?? 'no status'}.`);
  const text = await response.text();
  if (/session_secret|csrf_secret|database_url|password/i.test(text))
    throw new Error(`${name} leaked secret-like data.`);
  if (name.startsWith('api') && !response.headers.get('x-request-id'))
    throw new Error(`${name} lacks request ID.`);
  if (!response.headers.get('x-content-type-options'))
    throw new Error(`${name} lacks security headers.`);
}
process.stdout.write('Deployment smoke checks passed.\n');
