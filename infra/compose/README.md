# Local infrastructure

This Compose project runs development-only PostgreSQL, Redis, MinIO, and Mailpit services. Web, API, and Worker do not consume these services in F1.4. This topology, its credentials, and its published ports are not suitable for production.

## Images

| Service    | Image                                      | Reason                                                          |
| ---------- | ------------------------------------------ | --------------------------------------------------------------- |
| PostgreSQL | `postgres:17.10-alpine3.23`                | Official image with an exact database and Alpine patch tag      |
| Redis      | `redis:8.2.8-alpine`                       | Official image with an exact stable patch; includes `redis-cli` |
| MinIO      | `minio/minio:RELEASE.2025-09-07T16-13-09Z` | Official server image pinned to a dated release                 |
| MinIO init | `minio/mc:RELEASE.2025-08-13T08-35-41Z`    | Official client image pinned to a dated release                 |
| Mailpit    | `axllent/mailpit:v1.30.0`                  | Upstream image pinned to a security-updated release             |

Do not replace these with `latest`, `edge`, `nightly`, or a floating major tag. Validate health commands and read upstream release notes when updating an image.

## Configuration and ports

Root scripts set the repository as Compose's project directory, so Compose automatically reads the optional ignored root `.env`. Standard precedence applies: shell variables override `.env`, and development defaults in `docker-compose.yml` apply last. Copy `.env.example` to `.env` when you want explicit or customized values. To use another file, call Compose directly with `--env-file <path>`.

| Service       | Container port | Default published address |
| ------------- | -------------- | ------------------------- |
| PostgreSQL    | `5432`         | `127.0.0.1:5432`          |
| Redis         | `6379`         | `127.0.0.1:6379`          |
| MinIO API     | `9000`         | `127.0.0.1:9000`          |
| MinIO console | `9001`         | `127.0.0.1:9001`          |
| Mailpit SMTP  | `1025`         | `127.0.0.1:1025`          |
| Mailpit UI    | `8025`         | `127.0.0.1:8025`          |

All `POSTGRES_*`, `REDIS_*`, `MINIO_*`, and `MAILPIT_*` variables shown in `.env.example` are consumed by Compose. Host variables control the local bind address and should remain loopback-only. Password defaults are deliberately obvious development credentials; never reuse them elsewhere.

## Start and verify

Docker Engine with Compose v2 is required:

```sh
cp .env.example .env
pnpm infra:config
pnpm infra:pull
pnpm infra:up
pnpm infra:health
pnpm infra:status
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. `infra:health` waits up to 120 seconds for real Compose health states and for the one-shot MinIO bucket initializer to exit successfully. It returns a nonzero exit code on failure. PostgreSQL uses `pg_isready`, Redis uses `redis-cli ping`, MinIO uses its live HTTP endpoint, and Mailpit uses `/mailpit readyz`.

The private `match-evidence` bucket is created idempotently by `minio-init`; its name can be overridden through `MINIO_EVIDENCE_BUCKET`. To verify it after startup, rerun the initializer and inspect its exit code:

```sh
docker compose --project-directory . -f infra/compose/docker-compose.yml run --rm minio-init
```

This command also reapplies the `none` anonymous policy. Open the MinIO console at `http://127.0.0.1:9001` and Mailpit at `http://127.0.0.1:8025` when using default ports.

## Logs, restart, and shutdown

`pnpm infra:logs` follows all logs. Service-specific follow commands are available for PostgreSQL, Redis, MinIO (including init), and Mailpit. Stop following with Ctrl+C.

`pnpm infra:restart` restarts running long-lived services. `pnpm infra:down` removes containers and the Compose network but preserves all named volumes. A subsequent `infra:up` reuses the data.

`pnpm infra:reset` is destructive: it removes `postgres_data`, `redis_data`, and `minio_data` along with containers and the network. Use it only when all local database, cache, and object data may be permanently discarded.

## Persistence

The project-scoped named volumes are:

- `postgres_data` for PostgreSQL's standard data directory
- `redis_data` for append-only Redis persistence
- `minio_data` for objects and bucket metadata

Mailpit is intentionally ephemeral. It is a local email-capture tool, not a delivery service or durable mailbox.

## Troubleshooting

If startup reports a port conflict, identify the existing listener and either stop it yourself or override the relevant host port in `.env`; scripts never terminate unrelated processes. Inspect `pnpm infra:status`, then the service-specific logs. On Docker Desktop for Windows, ensure Linux containers and Compose v2 are enabled. Named volumes avoid host-path and filesystem-sharing differences across Windows, macOS, and Linux.

If `minio-init` fails, confirm MinIO is healthy, credentials match between both services, and the bucket name contains only S3-compatible characters. If `infra:health` reports a running service as unhealthy, inspect the container health log rather than relying on port availability.

This Compose project provides no TLS, production authentication posture, backup automation, high availability, monitoring stack, or public-network hardening. It must not be deployed to staging or production.
