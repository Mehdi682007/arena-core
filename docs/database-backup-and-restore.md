# Database backup and restore

## Backup

Use a least-privileged PostgreSQL backup role and encrypted storage outside the application host.
`pnpm db:backup` is dry-run by default. Set `DATABASE_URL` and `BACKUP_DIRECTORY`, then add
`--execute` only in an approved maintenance context. The script uses custom format, excludes
ownership, never prints the URL, and propagates `pg_dump` failure.

Record the file size, SHA-256, PostgreSQL version, database identifier, UTC time, retention class,
and release manifest. Encrypt in transit and at rest. A backup is not accepted until a scheduled
test restore succeeds.

## Restore drill

Restore to a new isolated database first. `pnpm db:restore -- path/to/file.dump` is a dry run.
Execution requires both `--execute` and `RESTORE_CONFIRM=RESTORE_ARENA_CORE`. The restore uses
`--clean --if-exists --no-owner --exit-on-error`; therefore it is destructive to the selected
target.

After restore:

1. Run migration status and compare the migration chain with the release manifest.
2. Run integrity queries appropriate to identity, ledger, settlement, and audit append-only data.
3. Start applications against the isolated target and run readiness/smoke checks.
4. Record duration and recovery point/time outcomes.

Never test restore against production, never assume application image rollback reverses schema,
and never delete the only backup after a failed drill.

# F10 acceptance requirement

The release candidate verifies backup/restore tooling statically. A real backup and isolated
restore comparison are mandatory during F10 before staging acceptance.
