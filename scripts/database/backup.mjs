import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const directory = path.resolve(process.env.BACKUP_DIRECTORY ?? 'backups');
const name = `arena-core-${new Date().toISOString().replaceAll(':', '-')}.dump`;
const target = path.join(directory, name);
if (!process.argv.includes('--execute')) {
  process.stdout.write(
    `Dry run: pg_dump --format=custom --no-owner --file <backup-dir>/${name} <DATABASE_URL>\n`,
  );
  process.exit(0);
}
await mkdir(directory, { recursive: true, mode: 0o700 });
const result = spawnSync(
  'pg_dump',
  ['--format=custom', '--no-owner', '--file', target, process.env.DATABASE_URL],
  {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false,
  },
);
if (result.status !== 0) throw new Error('pg_dump failed; no successful backup is claimed.');
process.stdout.write(`Backup created: ${target}\n`);
