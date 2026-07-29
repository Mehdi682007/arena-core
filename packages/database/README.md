# `@arena-core/database`

Framework-neutral Prisma and PostgreSQL boundary for server processes. It owns the Prisma schema, generated client, connection factory, lifecycle helpers, lightweight `SELECT 1` probe, and sanitized error classification. Browser and Web packages must not depend on it.

Local Docker infrastructure is implemented but not runtime-verified. Consequently, client generation and schema validation are verified, while real PostgreSQL connection and migration application remain blocked.

## Setup and configuration

Prisma ORM 7.9 uses the `prisma-client` generator with an explicit CommonJS output under `src/generated/prisma`. Prisma 7 requires the official PostgreSQL driver adapter. The generated directory is ignored and recreated explicitly:

```sh
pnpm db:format
pnpm db:validate
pnpm db:generate
```

`prisma.config.ts` loads the ignored root `.env` when present and uses `DATABASE_DIRECT_URL` for CLI and migration operations. Runtime clients use `DATABASE_URL`. Both are secrets and validation never echoes them.

`DATABASE_ENABLED=false` is the development/test default. API and Worker then create no client and make no connection attempt. Staging and production must set the switch explicitly. When enabled, both URLs are required and each server process owns one client.

Query logging is controlled by exact boolean `DATABASE_LOG_QUERIES`; it defaults to false and must remain off in production except during a specifically approved diagnostic window.
`DATABASE_CONNECT_TIMEOUT_SECONDS` bounds startup connection attempts to 1–60 seconds
and defaults to 5, so an unavailable database fails startup promptly.

## Migration workflow

| Command                                   | Purpose                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm db:migrate:dev`                     | Development-only creation and application using a shadow database                 |
| `pnpm db:migrate:create -- --name <name>` | Development-only `--create-only`; review SQL before applying                      |
| `pnpm db:migrate:deploy`                  | Apply committed migrations in test/staging/production without generating new ones |
| `pnpm db:migrate:status`                  | Compare committed and applied migration history                                   |
| `pnpm db:migrate:reset`                   | **Destructive** development/test reset; deletes database data                     |
| `pnpm db:studio`                          | Development-only data browser; never expose in production                         |
| `pnpm db:pull`                            | Destructive-to-schema introspection; review the diff and never use it casually    |

The first real migration is `20260725053000_init_identity`. It contains only the
Identity persistence foundation and was generated with the official
`prisma migrate diff --from-empty --to-schema ... --script` workflow. PostgreSQL
was unavailable, so it is generated and statically verified but not applied.
Empty migrations, placeholder models, and `prisma db push` remain prohibited.

`migrate dev` normally creates its temporary shadow database automatically and requires suitable development permissions. Managed environments that prohibit database creation will need a dedicated least-privilege shadow database in a later deployment decision; no unused `SHADOW_DATABASE_URL` exists today.

## Lifecycle and errors

Importing this package never connects. `createPrismaClient` constructs a client, while `connectPrisma` and idempotent `disconnectPrisma` are explicit. API and Worker wrap these helpers in their own Nest lifecycle services, so clients are never shared across processes. `checkDatabaseConnection` runs only constant `SELECT 1` with a bounded timeout.

Database errors are reduced to safe categories and a generic message. Raw queries, credentials, connection strings, and driver errors must never be sent in HTTP responses.

Never edit a migration already applied to a shared environment.

## Identity persistence

Identity is split across `User`, optional `UserProfile`, multiple `UserEmail`
records, an optional `PasswordCredential`, revocable `UserSession` records,
verification/reset tokens, and `Role`/`Permission` assignment tables. Prisma
models are persistence types and must never be returned directly by an API.

Standalone IDs are PostgreSQL-generated UUIDs using `gen_random_uuid()`; join
tables use composite primary keys. PostgreSQL supplies this function without a
new extension on the supported baseline. SQL names are snake_case while Prisma
models and fields use PascalCase/camelCase.

Account deletion transitions to `DELETED` with `deletedAt`; ordinary application
code must not physically delete users. Physical cascades exist only for future
controlled erasure of owned rows. Authorization catalog references use
`RESTRICT`; a removed assignment actor uses `SET NULL`.

Display and normalized email are separate. Future application code must
canonicalize before writing. The database requires a non-empty lowercase,
globally unique normalized value. A reviewed partial unique index allows at
most one primary email per user.

Only password hashes plus an algorithm identifier are persisted; algorithm
selection remains deferred. Session, verification, and reset secrets are stored
only as hashes. Hashes and containing Prisma records must never be logged or
serialized. Expiry is mandatory and enforced by SQL checks.

All timestamps are UTC instants mapped to `TIMESTAMPTZ(3)`. Locale is restricted
to `fa`/`en`; timezone remains an application-validated IANA string; country is
an optional uppercase ISO 3166-1 alpha-2 code.

The migration adds checks and the primary-email partial index that Prisma
Schema cannot represent. Static tests protect them. Once PostgreSQL is
available, apply with `pnpm db:migrate:deploy`, inspect
`pnpm db:migrate:status`, and run real constraint/delete integration tests.

# Release candidate

F9.4 preserves the 13-migration chain and requires schema, client generation, seed fixture, and
manifest checksum validation before F10.
