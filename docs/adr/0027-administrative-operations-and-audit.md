# ADR-0027: Administrative operations and append-only audit

- Status: Accepted
- Date: 2026-07-26

## Decision

Administrative support is an independent `@arena-core/admin-operations` bounded context. Domain
and application code do not depend on NestJS or Prisma. A Prisma adapter owns persistence and
read-only projections; NestJS only composes HTTP security and services.

Administrative actions are recorded in `admin_audit_events`. PostgreSQL rejects updates and
deletes with triggers, requires object-shaped JSON, and indexes deterministic
`created_at DESC, id DESC` access.

Search and timelines use explicit safe projections. Support mutation is limited to notification
retry and source recovery through existing notification services. Permissions are typed as
`audit.read`, `support.read`, `support.manage` and `timeline.read`; no permission is seeded or
granted automatically.

## Consequences

Support can investigate cross-context state without direct controller database access or a broad
mutation console. Timelines are operational projections, not a new source of truth.
