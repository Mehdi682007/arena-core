# Production environment checklist

Record owner, evidence, and completion time for every item during F10.

- [ ] VPS vendor/account protected; capacity and disk alerts configured
- [ ] Supported OS patched; automatic security updates reviewed
- [ ] Non-root operator and SSH keys configured; password/root login disabled
- [ ] Firewall exposes only approved SSH and reverse-proxy ports
- [ ] fail2ban or equivalent brute-force control enabled
- [ ] Docker Engine and Compose v2 versions recorded
- [ ] Adequate free disk and inode capacity verified
- [ ] NTP/time synchronization healthy
- [ ] DNS records and propagation verified
- [ ] TLS certificates, renewal, and HTTP-to-HTTPS redirect verified
- [ ] PostgreSQL private, authenticated, backed up, and connection-limited
- [ ] Fresh 13-migration chain applied successfully
- [ ] FC 26 seed run and validated only if approved
- [ ] Backup directory, encryption, retention, and off-host copy configured
- [ ] Isolated restore test completed
- [ ] SMTP credentials, sender policy, SPF/DKIM/DMARC, and test delivery verified
- [ ] Production secrets generated and stored outside Git
- [ ] Reverse proxy forwarding/trusted-proxy policy verified
- [ ] Liveness, readiness, and Web health checks configured
- [ ] Log rotation, redaction, retention, and access controls configured
- [ ] Monitoring/alerting and incident contacts recorded
- [ ] Immutable rollback image digest retained
- [ ] Container vulnerability scan has no unresolved critical/high finding
- [ ] Staging smoke and manual acceptance plans pass
