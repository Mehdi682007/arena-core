# Notifications

`@arena-core/notifications` owns versioned in-app and email notifications, lazy user
preferences, safe deterministic `fa`/`en` templates, transactional outbox creation,
append-only delivery attempts, bounded exponential retry, dead-letter and claim recovery.

The application and domain layers are independent from NestJS and Prisma. Persistence is
behind explicit repository and transaction ports; the Prisma adapter uses ownership-scoped
selects. Email delivery uses `@arena-core/email` and only a verified primary address.
Provider errors and email addresses are never exposed through notification projections.

Notification and per-channel outbox records are created atomically. SHA-256 keys make exact
domain retries idempotent while a payload hash detects conflicting retries. Preferences are
checked again at delivery time. In-app delivery is local; email is optional.

This foundation intentionally has no Redis, BullMQ, broker, polling worker, cron, push, SMS,
webhook, WebSocket, UI, or runtime in-memory store. When the database is disabled, registered
API routes return `NOTIFICATION_SERVICE_UNAVAILABLE`; no fallback data is fabricated.

Production post-commit integrations cover proposal creation, match-ready, confirmed/conflicting
results, dispute open/resolve, settlement and rating updates. The composition adapter reloads
final source state, creates per-recipient safe payloads, records sanitized failures and exposes
bounded permission-gated recovery. Exact replays use the source/version deduplication key.
