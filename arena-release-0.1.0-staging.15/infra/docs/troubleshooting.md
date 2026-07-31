# Troubleshooting

- SSH: keep the original session open, use provider console recovery, restore the timestamped SSH
  backup, run `sshd -t`, then reload rather than restart.
- Firewall: confirm the configured SSH port is allowed before enabling UFW; never reset unknown
  nftables rules blindly.
- Docker: use `docker version`, `docker compose version`, `systemctl status docker`, and inspect
  daemon logs. The framework never enables TCP API or insecure registries.
- Database: PostgreSQL has no host port. Check `docker compose ps`, health, migration status, and
  free disk. Never delete its named volume.
- Verification: run `infra/scripts/verify.sh INVENTORY`; inspect its restricted JSON report.
- Domain/TLS: IP staging is HTTP-only. Add a real domain and certificates later; do not enable HSTS
  before HTTPS is stable.
