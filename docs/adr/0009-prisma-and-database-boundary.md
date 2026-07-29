# ADR-0009: Prisma and database boundary

- Status: Accepted
- Date: 2026-07-25

## Context

API and Worker need a consistent PostgreSQL access and migration foundation without leaking ORM concerns into domain packages, Web bundles, or framework-specific shared code. Docker runtime from F1.4 remains unverified by explicit product-owner decision.

## Decision

Create server-only, framework-neutral `@arena-core/database` using stable Prisma ORM 7.9.0, PostgreSQL, the `prisma-client` generator with explicit CommonJS output, and Prisma's official PostgreSQL adapter. Each API or Worker process constructs at most one client through its own Nest lifecycle service. Import has no connection side effect; connect and idempotent disconnect are explicit.

`DATABASE_ENABLED` defaults false in development/test and must be explicit in staging/production. Enabled processes require runtime and direct PostgreSQL URLs and fail startup with sanitized errors. API liveness remains independent; readiness performs constant `SELECT 1` and discloses only disabled/up/down.

Prisma Schema is the executable source of truth but has no product models yet. No empty migration is created. Development creates reviewed migrations with `migrate dev`; deployments apply committed history with `migrate deploy`. `db push` is excluded because it can hide drift and bypass review.

## Consequences

Database behavior has one testable boundary, server processes never share cross-process clients, and Web cannot import Prisma transitively. Prisma 7 requires the official adapter and its PostgreSQL driver. Real database integration and migration application remain blocked until PostgreSQL is reachable, without blocking the static foundation.

## Alternatives rejected

- Direct Prisma imports in applications would scatter lifecycle and error policy.
- A Nest-specific shared database package would violate framework neutrality.
- Placeholder product models or empty migrations would create misleading history.
- Auto-connect on import would make tests and disabled mode unsafe.
- `db push` would bypass the migration audit trail.
