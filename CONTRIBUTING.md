# Contributing

## Setup

Use Node.js 24 LTS and the exact pnpm version declared in `package.json`. Enable Corepack, then run `pnpm install --frozen-lockfile`.

## Naming

- Packages: `@arena-core/<kebab-case-name>`.
- TypeScript files: `kebab-case.ts`; types/classes: `PascalCase`; values/functions: `camelCase`.
- Tests: `<subject>.test.ts` or `<subject>.spec.ts`, consistently within each application.

`Arena Core` and `@arena-core` are working names and may be replaced through a dedicated decision.

## Branches and commits

Suggested branches are `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, and `chore/<topic>`. Prefer focused Conventional Commits such as `chore: initialize workspace tooling`. Do not commit directly as part of automated task execution unless explicitly requested.

## Quality gates

Run `pnpm check`, `pnpm test`, and `pnpm build` before requesting review. Do not weaken strict TypeScript, disable lint rules broadly, ignore failures, or add fake scripts to make gates pass.

Run an individual application with `pnpm --filter @arena-core/<web|api|worker> dev` (or `start:dev` for API/worker). `pnpm dev` runs all development processes through Turbo.

Configuration changes belong in `packages/config` with parsing tests. Pass explicit environment objects to tests; do not mutate global `process.env`. Unknown variables are ignored, while known invalid values must fail fast. Keep server values out of Web client modules and reserve `NEXT_PUBLIC_` for reviewed, non-sensitive fields.

## Local infrastructure changes

- Pin every image to an exact version or dated release; `latest`, `edge`, `nightly`, and floating tags are forbidden.
- Run `pnpm infra:config` and `pnpm infra:health` after Compose changes when Docker is available.
- Every long-lived service requires a real healthcheck; opening a port or merely reaching `running` is insufficient.
- Never commit real credentials, `.env`, credential files, or resolved Compose output containing secrets.
- Document every new service's image source, variables, published ports, named volumes, dependencies, health behavior, and development-only limitations.
- Preserve cross-platform named volumes and loopback port binding. Do not introduce host-specific bind mounts without an accepted architectural reason.
- Update the Compose guide and ADR when changing image versions, persistence, initialization, or security behavior.

## Database and migrations

- Import Prisma only through `@arena-core/database`; Web and client-side code may never depend on it.
- Name migrations for intent using lowercase snake case, for example `create_identity_core`.
- Never rewrite or remove a migration applied to a shared environment.
- Never use `prisma db push` as a substitute for reviewed migration history.
- Generate migrations with development commands, inspect SQL for locks and destructive operations, and apply committed migrations in deployment with `migrate deploy`.
- Query logging stays disabled in production. Never log connection URLs, query parameters containing secrets, or raw driver errors.
- Schema, config, generator, and lifecycle changes require validation, client generation, tests, and updated documentation.

## Architecture and security

- Never commit secrets, tokens, credentials, private evidence, or real environment files.
- Keep environment examples non-sensitive.
- Update documentation and ADRs when behavior or architecture changes.
- Future modules own their database tables. No module may write another module's tables directly; use an application service or explicit contract.
- Keep real-money behavior disabled until the documented legal and payment gates are satisfied.
- Every new service must retain a deterministic health test and must not expose sensitive runtime metadata.
- Do not add product behavior outside the active task's explicit scope.
- Application-specific dependencies belong to that application. Shared packages must stay framework-neutral unless their documented purpose requires otherwise; depend on them through `workspace:*`.

## Ready for review

A task is reviewable when its scope and acceptance criteria are met, relevant tests and documentation are updated, all quality gates pass, migrations are safe when applicable, no important TODO remains undisclosed, and the diff contains no unrelated changes or secrets.
