import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const root = path.resolve(import.meta.dirname, '../..');
export const sha256 = (content) => createHash('sha256').update(content).digest('hex').toUpperCase();
export async function fileHash(relative) {
  return sha256(await readFile(path.join(root, relative)));
}
export async function migrations() {
  const directory = path.join(root, 'packages/database/prisma/migrations');
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  return Promise.all(
    entries.map(async ({ name }) => ({
      name,
      sha256: await fileHash(`packages/database/prisma/migrations/${name}/migration.sql`),
    })),
  );
}
export const images = ['api', 'worker', 'web', 'migrate', 'seed'];
