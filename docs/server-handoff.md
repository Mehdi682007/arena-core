# F10 server handoff

This is a provisioning handoff, not authorization to deploy.

## Release-candidate handoff status

Arena Core `0.1.0-rc.1` passed the online production dependency audit against
`registry.npmjs.org` at `2026-07-27T22:38:07Z` with exit code 0 and zero advisories. No automatic
fix, dependency update, manifest change, or lockfile change was made. The remaining checks in this
document are runtime prerequisites transferred to F10.

## Initial host assumptions

- Supported current Debian/Ubuntu LTS server, patched before use.
- Start with 4 vCPU, 8 GiB RAM, and 100 GiB encrypted SSD; measure before resizing.
- Install the pinned supported Docker Engine and Compose v2; do not use mutable image tags.
- Operate through a non-root sudo user with SSH keys, firewall, time synchronization, and a
  fail2ban-equivalent control.

## Network and domain topology

Expose only SSH from an approved source and HTTP/HTTPS through the reverse proxy. PostgreSQL and
application ports remain private. Plan DNS records for the Web origin and API origin, issue TLS
certificates, redirect HTTP to HTTPS, and preserve the trusted-proxy boundary documented in
`docs/production-security.md`.

## Configuration and secrets

Create environment files outside the repository using `.env.production.example`. Provision unique
session, database, SMTP, backup, and operational credentials through the server secret mechanism.
Never copy example values. Configure PostgreSQL connection limits, SMTP sender/domain alignment,
Web/API origins, CORS, cookie security, proxy hops, shutdown timeout, and rate limits.

## Build and rollout

Build the five pinned targets in `docker/Dockerfile`: `api`, `worker`, `web`, `migrate`, and `seed`.
Retain image digests and the verified RC manifest. Run migrations with the one-shot migrate target:

```text
pnpm db:migrate:deploy
```

Run the FC 26 seed only after explicit catalog approval:

```text
pnpm db:seed:fc26
```

Never start API/Web/Worker until migration success. Seed is not an application startup action.

## Operations

- Liveness: `/api/v1/health`
- Readiness: `/api/v1/health/ready`
- Web health: `/api/health`
- Backups: store outside the application checkout with restricted permissions and retention.
- Logs: JSON stdout/stderr, platform rotation, no secrets, and request-ID correlation.
- Reverse proxy: TLS termination, body/time limits, forwarded-header policy, and graceful drain.
- Rollback: retain the prior immutable image digest; do not reverse migrations automatically.
- Smoke: run `pnpm release:smoke` against the private staging endpoints.

Before accepting the server, complete `production-environment-checklist.md`, execute
`manual-acceptance-tests.md`, verify an isolated restore, and record owners and timestamps.
