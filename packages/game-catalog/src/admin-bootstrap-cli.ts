import { existsSync } from 'node:fs';
import process from 'node:process';
import { bootstrapAdministrator } from '@arena-core/admin-rbac';
import { createPrismaClient, disconnectPrisma } from '@arena-core/database';

function parseArguments(argv: readonly string[]): { email: string; verifyEmail: boolean } {
  let email = '';
  let verifyEmail = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--verify-email') verifyEmail = true;
    else if (argument === '--email') email = argv[++index] ?? '';
    else if (argument?.startsWith('--email=')) email = argument.slice('--email='.length);
    else throw new Error('Usage: admin:bootstrap --email <address> [--verify-email]');
  }
  if (!email) throw new Error('Usage: admin:bootstrap --email <address> [--verify-email]');
  return { email, verifyEmail };
}

/* eslint-disable no-console -- bounded CLI status is intentionally emitted. */
async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const { email, verifyEmail } = parseArguments(process.argv.slice(2));
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
    const result = await bootstrapAdministrator(client, { email, verifyEmail });
    console.log(
      result.alreadyAssigned
        ? 'Administrator role already assigned.'
        : 'Administrator role assigned.',
    );
    if (result.emailVerified) console.log('Primary email verified.');
    if (result.accountActivated) console.log('Eligible pending account activated.');
    console.log('Log out and sign in again to refresh authorization state.');
  } finally {
    await disconnectPrisma(client);
  }
}
void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const code = message.startsWith('ADMIN_BOOTSTRAP_') ? message : 'ADMIN_BOOTSTRAP_FAILED';
  if (code === 'ADMIN_BOOTSTRAP_SYSTEM_RBAC_MISSING')
    console.error('System RBAC is missing; run the system seed first.');
  else console.error(`Administrator bootstrap failed: ${code}`);
  process.exitCode = 1;
});
