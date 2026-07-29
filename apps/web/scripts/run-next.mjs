import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createWebConfig } = require('@arena-core/config');
const nextBinary = require.resolve('next/dist/bin/next');
const command = process.argv[2];

if (command !== 'dev' && command !== 'start') {
  throw new Error('Expected Next.js command to be "dev" or "start".');
}

const config = createWebConfig(process.env, {
  packageVersion: process.env.npm_package_version ?? '0.0.0',
});
for (const warning of config.warnings) process.stderr.write(`Configuration warning: ${warning}\n`);

const child = spawn(
  process.execPath,
  [nextBinary, command, '--hostname', config.network.host, '--port', String(config.web.port)],
  {
    stdio: 'inherit',
  },
);

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});

child.once('error', (error) => {
  process.stderr.write(`Failed to start the web process: ${error.message}\n`);
  process.exitCode = 1;
});
