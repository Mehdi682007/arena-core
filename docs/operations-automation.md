# Operations automation

`infra/scripts/install-operations-timers.sh` installs daily backup and five-minute monitoring timers.
The example inventory contains no credentials. Telegram alerting is disabled by default and reads its
token and chat id only from root-owned secret files. Repeated failures are deduplicated; a recovery
message is sent after health returns.

Operators inspect `systemctl list-timers 'arena-*'`, `systemctl status arena-monitor.service`,
`journalctl -u arena-monitor.service`, and `/var/lib/arena-monitor/last-result`. Backups use the
release's locked `backup.sh`; retention is 14 daily backups and the newest successful archive must
never be deleted. `/etc/arena/monitoring.env` must point `ARENA_INVENTORY_FILE` at the root-owned
production inventory. Cleanup is bounded, ignores partial/invalid archives, and deletes only older
archives whose checksum and `pg_restore -l` validation pass. Monitoring checks freshness and both
validations. Restore rehearsal is manual (not automated) and must use an isolated temporary
PostgreSQL instance, never the production DSN.

An optional offsite hook can be configured after backup completion. Credentials remain outside the
repository and no offsite command is enabled by default.
