import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsPath = resolve(process.cwd(), 'prisma/migrations');
const auditMigration = '20260731120000_create_admin_audit_events';
const notificationMigration = '20260730120000_create_notifications_and_delivery_outbox';

describe('migration directory ordering', () => {
  it('uses valid unique timestamps in strictly increasing lexical order', async () => {
    const folders = (await readdir(migrationsPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const folder of folders) expect(folder).toMatch(/^\d{14}_[a-z0-9_]+$/);

    const timestamps = folders.map((folder) => folder.slice(0, 14));
    expect(new Set(timestamps).size).toBe(timestamps.length);
    for (let index = 1; index < timestamps.length; index += 1) {
      const current = timestamps[index];
      const previous = timestamps[index - 1];
      if (!current || !previous) throw new Error('Migration timestamp is missing.');
      expect(current > previous).toBe(true);
    }

    expect(folders.at(-1)).toBe('20260804010000_add_admin_user_restrictions');
    expect(folders.indexOf(auditMigration)).toBeGreaterThan(folders.indexOf(notificationMigration));
  });

  it('keeps the audit migration self-contained and append-only', async () => {
    const sql = await readFile(resolve(migrationsPath, auditMigration, 'migration.sql'), 'utf8');
    const allSql = await Promise.all(
      (await readdir(migrationsPath, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => readFile(resolve(migrationsPath, entry.name, 'migration.sql'), 'utf8')),
    );

    expect(sql).toContain('CREATE TABLE "admin_audit_events"');
    expect(sql).toContain('REFERENCES "users"("id")');
    expect(sql).toContain('jsonb_typeof("metadata") = \'object\'');
    expect(sql).toContain('admin_audit_events_no_update');
    expect(sql).toContain('admin_audit_events_no_delete');
    expect(sql.indexOf('CREATE TABLE "admin_audit_events"')).toBeLessThan(
      sql.indexOf('CREATE TRIGGER "admin_audit_events_no_update"'),
    );
    expect(
      allSql.join('\n').match(/CREATE OR REPLACE FUNCTION reject_admin_audit_mutation/g),
    ).toHaveLength(1);
  });
});
