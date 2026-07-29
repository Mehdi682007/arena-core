# ADR-0016: FC 26 seed and initial rulesets

- Status: Accepted
- Date: 2026-07-25

## Context

F3.1 supplied game-agnostic catalog tables and lifecycle policies. F3.2 needs a repeatable
FC 26 bootstrap without changing that schema or treating Arena competition policy as
official publisher data.

## Decision

Keep a typed FC 26 fixture and validator in `@arena-core/game-catalog`. Seed the game,
seven platforms, game-platform matrix, four compatibility pools, 1v1 and 2v2 modes, and
one active version-1 Arena Core ruleset per mode in a single Prisma transaction.

Use natural catalog keys with Prisma upserts. Re-running the seed converges mutable
catalog metadata and reconstructs cross-play memberships. Published rulesets are an
exception: an identical active key/version is reused, while any configuration or
lifecycle mismatch raises `Fc26SeedDriftError`; it is never overwritten or reactivated.

Official EA facts and Arena Core house rules are documented separately in
`docs/catalog-sources/fc26.md`.

The commands are:

- `pnpm db:seed` — default seed entry point, currently FC 26.
- `pnpm db:seed:fc26` — connect to PostgreSQL and apply the transaction.
- `pnpm db:seed:validate` — validate the fixture locally without claiming persistence.

## Consequences

No migration is required after F3.1. Running the actual seed requires `DATABASE_URL` and
`DATABASE_DIRECT_URL` and a migrated PostgreSQL database. Fixture validation is safe
without a database, but is not evidence that records were persisted.
