# Backup and restore review

Backup executes `pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc` in PostgreSQL 17.10. Custom
format provides compression. Uploads, deployment metadata, and filename-only secret inventory are
included. SHA-256 checksums precede atomic `.partial` rename; failure removes only the partial path.

Restore is staging-only, requires `RESTORE_CONFIRM=RESTORE_ARENA_STAGING`, validates checksums, and
runs `pg_restore --clean --if-exists --no-owner --exit-on-error`. Operator-controlled downtime,
free-space validation, isolated restore, and connection proof remain runtime checks.

```bash
BACKUP_TEST_MODE=true infra/scripts/backup.sh INVENTORY
RESTORE_TEST_MODE=true infra/scripts/restore.sh INVENTORY BACKUP_DIR
```
