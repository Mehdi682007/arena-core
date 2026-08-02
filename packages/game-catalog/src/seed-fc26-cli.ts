import { existsSync } from 'node:fs';
import process from 'node:process';
import { seedSystemRbac } from '@arena-core/admin-rbac';
import { createPrismaClient, disconnectPrisma } from '@arena-core/database';
import { seedFc26Catalog } from './fixtures/fc26-seed';

/* eslint-disable no-console -- CLI result is intentionally written to stdout. */
async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DATABASE_DIRECT_URL?.trim() ?? url;
  if (!url || !directUrl) throw new Error('DATABASE_URL and DATABASE_DIRECT_URL are required.');
  const client = createPrismaClient({
    enabled: true,
    url,
    directUrl,
    logQueries: false,
    connectTimeoutSeconds: 5,
  });
  try {
    const rbac = await seedSystemRbac(client);
    console.log(`System RBAC seed completed (${String(rbac.permissionCount)} permissions).`);
    await seedFc26Catalog(client);
    console.log('FC 26 catalog seed completed.');
  } finally {
    await disconnectPrisma(client);
  }
}

void main();
