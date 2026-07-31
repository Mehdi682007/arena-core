import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const source = process.argv.find((value) => value.endsWith('.dump'));
if (!source || !process.env.DATABASE_URL)
  throw new Error('A .dump path and DATABASE_URL are required.');
if (!process.argv.includes('--execute')) {
  process.stdout.write(
    `Dry run: pg_restore --clean --if-exists --no-owner --dbname <DATABASE_URL> ${path.resolve(source)}\n`,
  );
  process.exit(0);
}
if (process.env.RESTORE_CONFIRM !== 'RESTORE_ARENA_CORE') {
  throw new Error('Set RESTORE_CONFIRM=RESTORE_ARENA_CORE for the destructive restore.');
}
const result = spawnSync(
  'pg_restore',
  [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--exit-on-error',
    '--dbname',
    process.env.DATABASE_URL,
    path.resolve(source),
  ],
  { stdio: ['ignore', 'inherit', 'inherit'], shell: false },
);
if (result.status !== 0) throw new Error('pg_restore failed.');
process.stdout.write('Restore completed; run migration status and application smoke checks.\n');
