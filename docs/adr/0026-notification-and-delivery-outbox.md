# ADR 0026: Notification and delivery outbox

## Context

Matchmaking, match results, disputes, settlement, rating and security flows need private,
idempotent notifications without coupling those domains to a transport or queue product.

## Decision

Arena Core owns an independent `@arena-core/notifications` boundary. It supports only
`IN_APP` and `EMAIL`. Versioned types use deterministic, server-owned `fa` and `en`
templates with HTML escaping and a `fa` fallback. Payloads are small, flat, JSON-safe and
reject secret or identity-bearing keys.

Notification, preference, outbox and append-only attempt records are persisted by Prisma.
A notification and its per-channel outbox rows are created in one transaction. SHA-256
deduplication identifies an event; a separate payload hash rejects conflicting reuse.
Preferences use server defaults and lazy overrides, and are rechecked before delivery.
Email delivery is delegated to the existing email package and requires an active user with
a verified primary email.

Delivery supports bounded exponential retries, terminal dead-letter state, optimistic
claims with an expiring lease, and explicit administrative retry/recovery. Domain
coordinators invoke notification creation after durable domain work and tolerate delivery
failure; reconciliation can replay the same versioned event idempotently.

There is no background polling worker in this phase. There is also no Redis, BullMQ,
broker, cron, push, SMS, webhook, WebSocket, bulk campaign, or UI.

## Consequences

Private APIs can list, read/unread and archive owned notifications and update owned
preferences. Permission-gated admin APIs can inspect safe outbox projections and retry
terminal messages but cannot edit payloads. With the database disabled, routes remain
registered and fail with a redacted 503 rather than using an in-memory fallback.

## Alternatives rejected

Direct email in domain transactions risks rollback and latency. A broker or Redis-backed
worker adds infrastructure outside this phase. User-authored HTML and mutable attempt
history weaken XSS safety and auditability. A generic cross-domain event framework would
create coupling beyond the required integration seam.

## Production integrations

The composition layer installs post-commit hooks for proposal creation, match creation,
result confirmation/conflict, dispute open/resolve, settlement and rating application.
Each hook reloads final source state with bounded Prisma selects and builds recipient-specific
payloads. Failure is logged with only source type/id and never changes the successful domain
result. Permission-gated source recovery repeats the same derivation idempotently.
