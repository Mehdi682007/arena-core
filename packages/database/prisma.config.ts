import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { defineConfig, env } from 'prisma/config';

const rootEnvironmentFile = resolve(__dirname, '../../.env');
if (existsSync(rootEnvironmentFile)) process.loadEnvFile(rootEnvironmentFile);

export default defineConfig({
  schema: resolve(__dirname, 'prisma/schema.prisma'),
  migrations: {
    path: resolve(__dirname, 'prisma/migrations'),
  },
  datasource: {
    url: env('DATABASE_DIRECT_URL'),
  },
});
