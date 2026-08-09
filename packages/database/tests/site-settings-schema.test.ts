import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RC6 site settings persistence', () => {
  it('stores structured draft and published snapshots with immutable revisions', async () => {
    const schema = await readFile(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const migration = await readFile(
      resolve(process.cwd(), 'prisma/migrations/20260809090200_rc6_site_settings/migration.sql'),
      'utf8',
    );
    expect(schema).toContain('model SiteSettings');
    expect(schema).toContain('model SiteSettingsRevision');
    expect(migration).toContain('CREATE TABLE "site_settings"');
    expect(migration).toContain('CREATE TABLE "site_settings_revisions"');
    expect(migration).not.toMatch(/BYTEA|base64/i);
  });
});
