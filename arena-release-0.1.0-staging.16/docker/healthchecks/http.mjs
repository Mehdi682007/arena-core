import http from 'node:http';
import https from 'node:https';
import process from 'node:process';
import { URL } from 'node:url';

const target = new URL(process.argv[2] ?? '');
const client = target.protocol === 'https:' ? https : http;
const request = client.get(target, { timeout: 2_000 }, (response) => {
  response.resume();
  process.exit(response.statusCode !== undefined && response.statusCode < 400 ? 0 : 1);
});
request.once('timeout', () => request.destroy(new Error('probe timeout')));
request.once('error', () => process.exit(1));
