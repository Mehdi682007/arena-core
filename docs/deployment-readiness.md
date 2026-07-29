# Deployment readiness

This document is preparation, not a deployment procedure.

F9.4 consolidates the first release-candidate decision in `launch-readiness.md`; the operational
handoff is `server-handoff.md` and every unavailable runtime check remains an F10 prerequisite.

Before release: validate production configuration in a clean process; run all quality gates;
review dependency audit output; verify backups and restore ownership; deploy schema migrations
externally before application rollout; record immutable version/build SHA; and provision reachable
PostgreSQL, TLS termination, and the declared trusted proxy topology.

The orchestrator should use `/api/v1/health` for liveness and `/api/v1/health/ready` for traffic
readiness. On SIGTERM/SIGINT, readiness flips before Nest closes dependencies. The configured
shutdown deadline must exceed the load balancer drain time.

Known environment blockers at F8.1 verification time are unavailable Docker and PostgreSQL
runtimes. Redis and external metrics/logging/error providers are deliberately absent.

F8.2 adds a build-only container workflow, immutable release manifest, independent migrate/seed
runners, static preflight, smoke tooling, and backup/restore safety. Follow
`release-checklist.md`, `deployment-runbook.md`, and `database-backup-and-restore.md`; none of
these artifacts represents a completed deployment.
