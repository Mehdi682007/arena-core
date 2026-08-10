# Deployment Baseline

## Environments

Local, test, staging, and production use the same container contracts with environment-specific secrets and managed services.

Supported `APP_ENV` values are `local`, `test`, `staging`, and `production`. `NODE_ENV` must map to `development`, `test`, `production`, and `production` respectively. Development/test use safe local defaults. Staging/production require `LOG_LEVEL`, `HOST`, and each service's operational settings explicitly; configuration errors terminate before a listener or worker context starts.

| Variable                     | Service    | Development default | Staging/production                         |
| ---------------------------- | ---------- | ------------------- | ------------------------------------------ |
| `APP_VERSION`                | all        | package version     | release identifier or package version      |
| `LOG_LEVEL`                  | all        | `info`              | required                                   |
| `HOST`                       | Web/API    | `127.0.0.1`         | required                                   |
| `WEB_PORT`                   | Web        | `3000`              | required                                   |
| `NEXT_PUBLIC_APP_NAME`       | Web/public | `Arena Core`        | required                                   |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | Web/public | `fa`                | required (`fa` or `en`)                    |
| `API_PORT`                   | API        | `3001`              | required                                   |
| `API_PREFIX`                 | API        | `/api/v1`           | required                                   |
| `CORS_ENABLED`               | API        | `false`             | required (`true` or `false`)               |
| `CORS_ALLOWED_ORIGINS`       | API        | empty               | required when CORS is enabled; no wildcard |
| `WORKER_SHUTDOWN_TIMEOUT_MS` | Worker     | `10000`             | required (1000–120000)                     |

The Node engine range is enforced at startup. Development prints a warning when the running patch differs from `.nvmrc` but remains inside the supported engine. Next.js handles Web local env loading. API and Worker receive variables from the shell, container, or process orchestrator; production must not depend on local dotenv files.

## Local topology

The F1.4 Docker Compose project provides only PostgreSQL, Redis, MinIO, and Mailpit for local development. Applications continue to run on the host and are not integrated with these services yet. Published ports bind to loopback by default, state uses named volumes, and Mailpit data is ephemeral.

The API integrates with Mailpit through SMTP when `SMTP_ENABLED=true`. Local defaults are
`127.0.0.1:1025`, no authentication, and non-implicit TLS. Staging/production must explicitly
configure the public identity URL and SMTP settings; Mailpit is never a production delivery
provider. Set `IDENTITY_EMAIL_DELIVERY_REQUIRED=true` only when SMTP unavailability should abort
startup.

This topology is not a production deployment template. Production architecture will separately evaluate managed PostgreSQL, Redis, object storage, and transactional email. Development credentials must never be reused. Local named volumes and manual lifecycle commands are not a production backup, restore, availability, or disaster-recovery guarantee.

## Delivery

CI stages: install from lockfile, format check, lint, strict type-check, unit tests, integration tests, Prisma validation/migration check, builds, dependency/security scan, and E2E smoke tests. Images are immutable and tagged by commit.

Deployment order: database backup/check → backward-compatible migration → API/worker → web → smoke/readiness verification. Destructive migrations require an expand/migrate/contract sequence.

## Operations

Structured JSON logs, request/correlation IDs, health and readiness endpoints, queue depth/failure monitoring, migration status, metrics abstraction, alerts for settlement/reconciliation failures, encrypted backups, and documented restore tests.

No production deployment is part of Phase 0.

## Database delivery

Builds explicitly run Prisma Client generation; generated code is not hand-edited. Runtime connection credentials arrive through secret injection as `DATABASE_URL`, while migration/administrative operations use `DATABASE_DIRECT_URL` so pooled and direct endpoints can differ.

Deployment applies already-reviewed migrations with `prisma migrate deploy` before starting the new API and Worker revision. `migrate deploy` never generates migrations. `migrate dev`, `migrate reset`, Studio, introspection, and `db push` are forbidden production operations. Runtime and migration roles should become distinct least-privilege credentials when the production provider is selected.

Local Docker infrastructure is implemented but not runtime-verified. Database-enabled deployment and migration application therefore remain unverified until a reachable PostgreSQL environment is available.
