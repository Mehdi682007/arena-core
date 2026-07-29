# Deployment runbook

## Boundaries

The repository supplies build and verification artifacts only. It does not configure a registry,
server, DNS, TLS, reverse proxy, or production database. Production PostgreSQL is external; the
production Compose file does not publish a database port.

## Images and configuration

Build `docker/Dockerfile` targets `api`, `worker`, `web`, `migrate`, and `seed` using the same
`BUILD_SHA` and `RELEASE_VERSION`. The base is pinned to Node 24.14.0 Debian slim and pnpm 11.9.0.
Digest pinning remains an operator release step because this environment cannot resolve and verify
the upstream multi-architecture digest.

Provide secrets through the deployment platform's encrypted secret store. Materialize them as
process environment only at container creation; never commit an env file, bake secrets into an
image, pass them as build arguments, or print them. If the platform uses mounted secret files, its
supervisor must read each file and inject the value because Arena Core intentionally accepts the
typed variables documented in `production-configuration.md`.

## Ordered deployment

1. Verify the release manifest, backup, target environment, proxy topology, and TLS.
2. Pull or load all images by immutable tag/digest.
3. Run `arena-migrate`; a database connection failure is a hard failure.
4. Start API, Worker, and Web. Migration and seed are never application entrypoints.
5. Wait for API readiness and Web health, then shift traffic.
6. Run the bounded smoke script and observe structured logs/metrics.

Compose binds application ports to loopback as a reverse-proxy foundation. `read_only`,
`no-new-privileges`, dropped capabilities, fixed UID/GID, bounded temporary filesystems, log
rotation, memory/CPU limits, restart policies, and stop grace periods are defaults. Tune limits
from measured staging load; an OOM terminates the container and should trigger investigation, not
an unbounded limit.

## Staging and local use

`compose.staging.yml` adds pinned PostgreSQL with a named volume and no published host port. The
original `docker-compose.yml` remains the development-only dependency stack, with loopback ports
and explicit insecure defaults. It is not a production overlay.

## Rollback

Roll applications back to the previous immutable images. Database rollback is never automatic:
prefer a reviewed forward fix; restore only with explicit incident authorization and a verified
backup. Re-run readiness and smoke checks before restoring traffic.
