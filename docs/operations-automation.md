# Operations automation

`infra/scripts/install-operations-timers.sh` installs daily backup and five-minute monitoring timers.
The example inventory contains no credentials. Telegram alerting is disabled by default and reads its
token and chat id only from root-owned secret files. Repeated failures are deduplicated; a recovery
message is sent after health returns.

Operators inspect `systemctl list-timers 'arena-*'`, `systemctl status arena-monitor.service`,
`journalctl -u arena-monitor.service`, and `/var/lib/arena-monitor/last-result`. Backups use the
release's locked `backup.sh`; retention is 14 daily backups and the newest successful archive must
never be deleted. Before restoration, verify SHA-256 and run `pg_restore -l` against the dump.
Restore rehearsals must use an isolated temporary PostgreSQL instance, never the production DSN.

An optional offsite hook can be configured after backup completion. Credentials remain outside the
repository and no offsite command is enabled by default.
