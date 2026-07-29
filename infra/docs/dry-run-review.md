# Dry-run review

`deploy.sh INVENTORY --dry-run` validates inventory, derives versioned release paths, checks the
release manifest, and runs `docker compose config`. It exits before
build/pull, PostgreSQL startup, backup, migration, application startup, health checks, symlink
activation, or metadata writes.

| Path                                   | Behavior              |
| -------------------------------------- | --------------------- |
| inventory and paths                    | Validate/read only    |
| deployment lock                        | Not opened or created |
| release check                          | Read only             |
| Compose config                         | Parse/render only     |
| build/pull/backup/migrate/start/verify | Skipped               |
| symlink and metadata                   | Skipped               |

Provisioning dry-run also skips its lock and system-configuration backup. Managed-file writes,
preflight reports, user-dependent ownership work, Docker repository installation, swap activation,
firewall, SSH, and service mutations are printed or inspected only. This makes it usable before the
operator and runtime users exist. No temporary, lock, backup, runtime, or system-state file is
created by dry-run.
