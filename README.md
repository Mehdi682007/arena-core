# Arena Core

The first integrated candidate is `0.1.0-rc.1`. Its local verification and F10 prerequisites are
recorded in [`docs/launch-readiness.md`](docs/launch-readiness.md) and
[`docs/server-handoff.md`](docs/server-handoff.md). This RC is not a production deployment.

Arena Core is the neutral working name for a game-agnostic competition platform. Identity HTTP
flows now use the framework-neutral `@arena-core/email` boundary for localized verification and
password-reset delivery through SMTP.

Local Docker infrastructure is implemented but not runtime-verified. This is an explicitly accepted project-owner risk; no successful PostgreSQL connection is claimed.

Production container and release foundations are documented in
[`docs/deployment-runbook.md`](docs/deployment-runbook.md). CI verifies and builds artifacts only;
it does not push images or deploy infrastructure.

The F9.1 user Web application provides a Persian RTL design system, secure session/API boundary,
identity flows, dashboard/profile/notification foundations, settings, and a public leaderboard.
See [`docs/web-architecture.md`](docs/web-architecture.md) and
[`docs/design-system.md`](docs/design-system.md).

## Architecture

The MVP is a TypeScript modular monolith in a pnpm/Turborepo workspace. The current applications are a Next.js web shell, a NestJS HTTP API, and a non-HTTP NestJS application-context worker. BullMQ and every external dependency are deferred.

Real-money deposits, withdrawals, and settlement are disabled. MVP financial flows will use non-redeemable test credits only.

## Prerequisites

- Node.js 24 LTS (`.nvmrc` pins the recommended patch)
- Corepack
- Git
- Docker Engine with Docker Compose v2 (for local infrastructure)

Enable Corepack and install dependencies:

```sh
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
```

For the first install before a lockfile exists, use `pnpm install`.

## Scripts

| Command             | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `pnpm format`       | Format tracked source/configuration/documentation      |
| `pnpm format:check` | Verify formatting                                      |
| `pnpm lint`         | Run workspace lint tasks and root Flat Config lint     |
| `pnpm typecheck`    | Run workspace checks and the root TS solution          |
| `pnpm test`         | Run package tests; currently reports no package tasks  |
| `pnpm build`        | Run package builds; currently reports no package tasks |
| `pnpm clean`        | Run package cleanup and remove the root Turbo cache    |
| `pnpm check`        | Run format check, lint, and typecheck                  |

## Local infrastructure

Copy `.env.example` to the ignored root `.env`; its PostgreSQL and MinIO passwords are intentionally insecure development-only examples. Then start and verify the isolated infrastructure:

```sh
pnpm infra:config
pnpm infra:pull
pnpm infra:up
pnpm infra:health
```

Default local endpoints are PostgreSQL `127.0.0.1:5432`, Redis `127.0.0.1:6379`, MinIO API `http://127.0.0.1:9000`, MinIO console `http://127.0.0.1:9001`, Mailpit SMTP `127.0.0.1:1025`, and Mailpit UI `http://127.0.0.1:8025`.

Email is disabled by default. Set `SMTP_ENABLED=true` to send identity mail to local Mailpit, then
open its UI at `http://127.0.0.1:8025`. `IDENTITY_EMAIL_DELIVERY_REQUIRED=true` makes API startup
verify SMTP availability; otherwise the transport connects only when a message is sent.

Use `pnpm infra:down` to stop containers while retaining named-volume data. `pnpm infra:reset` is destructive and permanently removes the PostgreSQL, Redis, and MinIO volumes. See the [local infrastructure guide](infra/compose/README.md) for configuration, logs, persistence, and troubleshooting.

Web, API, and Worker are deliberately not connected to these services in F1.4. No Prisma, queue, storage, or mail client is installed.

## Run applications

| Service | Development command                          | Default address                       |
| ------- | -------------------------------------------- | ------------------------------------- |
| Web     | `pnpm --filter @arena-core/web dev`          | `http://127.0.0.1:3000`               |
| API     | `pnpm --filter @arena-core/api start:dev`    | `http://127.0.0.1:3001/api/v1/health` |
| Worker  | `pnpm --filter @arena-core/worker start:dev` | Non-HTTP; logs lifecycle health       |

Run all three with `pnpm dev`. Web health is available at `/health` and `/api/health`; API liveness is at `/api/v1/health`. Stop the worker with `SIGINT` or `SIGTERM`.

API database readiness is available at `/api/v1/health/ready`. With the default `DATABASE_ENABLED=false`, it reports the database as disabled without creating a Prisma client. Enabling it requires valid server-only `DATABASE_URL` and `DATABASE_DIRECT_URL`; API and Worker then fail startup if connection cannot be established.
Startup connection attempts are bounded by `DATABASE_CONNECT_TIMEOUT_SECONDS` (default: 5).

## Database foundation

`@arena-core/database` owns Prisma 7.9, PostgreSQL adapter construction,
connection lifecycle, safe probing, and migration commands. Its first
executable domain slice is the Identity schema with the unapplied
`init_identity` migration and versioned identity HTTP endpoints.

```sh
pnpm db:format
pnpm db:validate
pnpm db:generate
```

Development uses `db:migrate:dev` or reviewed `db:migrate:create`; deployment uses only `db:migrate:deploy`. `db:migrate:reset` destroys development/test data. `db:pull` can overwrite the designed schema and must be used only for deliberate introspection. `db push` is not part of the workflow. See the [database package guide](packages/database/README.md).

Copy `.env.example` values into your shell or a local ignored environment file as needed. Next.js loads its supported local env files for Web. API and Worker read the environment supplied by the shell/process supervisor; they deliberately do not load dotenv files themselves. Development and test have safe defaults. Staging and production require operational values explicitly and fail before application bootstrap when validation fails.

Only `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_DEFAULT_LOCALE` are browser-safe. Never expose server variables through a `NEXT_PUBLIC_` name. See [deployment configuration](docs/deployment.md) for the complete matrix.

These services are deliberately health-only. They contain no user, game, wallet, matchmaking, queue, persistence, or real-money behavior.

## Structure

```text
apps/
  web/                   Next.js health-only shell
  api/                   NestJS health-only HTTP API
  worker/                NestJS non-HTTP application context
packages/
  config/                Framework-neutral typed environment validation
  contracts/             Framework-neutral health contract
  database/              Server-only Prisma and PostgreSQL boundary
  eslint-config/        Shared ESLint Flat Config
  typescript-config/    Shared strict TypeScript configurations
docs/                   Tracked copy of Phase 0 documentation
infra/
  compose/              Development Compose topology and health tooling
tests/
  e2e/                  Future end-to-end tests
```

Internal packages use the `@arena-core/*` scope. Both the project name and scope are working identifiers, not the final product brand.

Start with the [Discovery index](docs/README.md), [architecture](docs/architecture.md), and [ADRs](docs/adr/README.md). The immutable source snapshot remains in `outputs/phase-0-discovery/` locally and is intentionally excluded from Git.

The user and administrative Web experiences are documented in
[competition journeys](docs/competition-web-journeys.md) and the
[administrative Web application](docs/admin-web-application.md).
