# Backup, restore, and rollback

```bash
sudo infra/scripts/backup.sh /secure/path/arena-staging.env
ROLLBACK_CONFIRM=0.1.0-rc.1 sudo -E infra/scripts/rollback.sh /secure/path/arena-staging.env 0.1.0-rc.1
RESTORE_CONFIRM=RESTORE_ARENA_STAGING sudo -E infra/scripts/restore.sh /secure/path/arena-staging.env /opt/arena/backups/TIMESTAMP
```

Backups validate free space, remove partial output after failure, use root-only ownership, and
checksum every artifact. Container and external PostgreSQL use the same backup contract. Restore is
staging-only and guarded; it stops application services, restores the selected database, restarts
the application, and verifies health.

Rollback recreates API, worker, and web containers from the selected immutable release and verifies
health before moving `current`. If the target fails, it recreates and verifies the prior release.
Deployment performs the same automatic image rollback after a failed health check and records the
result in `shared/deployment.json`. Database migrations are never reversed; schema incompatibility
still requires a forward fix.
