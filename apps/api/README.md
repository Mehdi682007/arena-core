# API service

F8.1 production contracts are documented in
[`docs/production-configuration.md`](../../docs/production-configuration.md),
[`docs/production-security.md`](../../docs/production-security.md), and
[`docs/observability.md`](../../docs/observability.md). The API applies exact CORS, explicit proxy
trust, security headers/API CSP, bounded request IDs, correlation context, safe errors,
health/readiness, admin diagnostics, and graceful shutdown. Runtime migrations are forbidden.

The administrative F7.2 route inventory, permission mapping and privacy constraints are documented
in [`docs/administrative-operations.md`](../../docs/administrative-operations.md).

## Match Finance

Private user routes reserve, get, and list Match entry reservations. Admin routes under
`/api/v1/admin/match-finance` require `match_finance.read`, `match_finance.manage`, or
`match_finance.reconcile`. Writes are CSRF protected, DTOs strict, responses `no-store`, and
amount/asset server-owned. Disabled database mode returns
`MATCH_FINANCE_SERVICE_UNAVAILABLE`.

## Match result routes

Private participant routes are `POST /matches/:id/start`,
`POST /matches/:id/result-submissions`, `POST /matches/:id/result-submissions/withdraw` and
`GET /matches/:id/result`. Admin conflict routes are under `/admin/match-results` and require
`match_results.read` or `match_results.resolve`.

Writes use the existing CSRF/origin and rate-limit protections. All responses are `no-store`.
Participant views never expose opponent submission records or internal participant/user IDs.
With the database disabled, authenticated database operations return a redacted 503 and no
in-memory runtime store is created.

## Game catalog

Public routes are `GET /api/v1/catalog/games`, `GET /api/v1/catalog/games/:slug`, and
`GET /api/v1/catalog/games/:slug/rulesets/default`; they are anonymous, active/visible-only, and set
`public, max-age=60, stale-while-revalidate=300`.

The `/api/v1/admin/catalog` foundation supports games, shared platforms, game-platform attachment,
modes, crossplay groups, and draft/publish/default/archive ruleset flows. It reuses session and CSRF
guards, validates strict JSON DTOs, returns `no-store`, and uses `games.manage`,
`platforms.manage`, or `rulesets.manage`. The production system seed installs the typed
permission catalog and `super_admin` role without assigning any user; administrator assignment
uses the separate audited bootstrap command.

When `DATABASE_ENABLED=false`, routes still register: public database operations return
`GAME_CATALOG_UNAVAILABLE`, unauthenticated admin calls return 401, and authorization fails closed.

The API exposes health/readiness and the identity HTTP boundary under `/api/v1`.

Identity uses an opaque `arena_session` HttpOnly cookie; JWT and browser-local token storage are not
supported. All auth responses use `Cache-Control: no-store`. Unsafe requests are JSON-only and
checked against the configured Origin allowlist. Authentication is default-protected; only health,
registration/login, verification, and reset endpoints carry explicit public metadata.

With `DATABASE_ENABLED=false`, the API and health routes start normally while persistence-dependent
identity calls return a redacted `503 IDENTITY_SERVICE_UNAVAILABLE`. Runtime has no in-memory
identity fallback.

F2.4 supplies identity email through the framework-neutral `@arena-core/email` package. Registration
remains persisted if delivery fails, but the request
returns `503 IDENTITY_DELIVERY_UNAVAILABLE`; verification can later be requested again. Test
integration injects an inspectable capture dispatcher. Tokens are never logged or returned in JSON.

There is no identity UI, JWT, OAuth, MFA, Redis, or distributed limiter. OpenAPI is deferred.

## Private profile API

The protected routes are `GET/PATCH /api/v1/profile`, `GET /api/v1/onboarding`, and
`POST /api/v1/onboarding/complete`. PATCH accepts a strict non-empty subset of `displayName`,
`locale`, `timezone`, and nullable `countryCode`. Writes reuse JSON/origin CSRF enforcement and all
responses are `Cache-Control: no-store`. `/auth/me` remains an identity/session summary.

With `DATABASE_ENABLED=false`, routes still register: unauthenticated calls return `401`, while an
authenticated profile operation returns sanitized `503 PROFILE_SERVICE_UNAVAILABLE`. Production
does not install an in-memory profile store.

## Private game-account API

Users can list/create/get/disconnect/set-primary/resubmit under `/api/v1/game-accounts`. Admin
review routes live under `/api/v1/admin/game-accounts` and require `game_accounts.read`,
`game_accounts.verify`, or `game_accounts.suspend`. All routes require a session, are no-store,
and writes require JSON plus an allowed Origin. Verification is manual only; users cannot set
status, method, metadata, or primary during creation. Database-disabled calls fail with sanitized
`503 PLAYER_IDENTITY_UNAVAILABLE`.

Create, resubmit, and admin review actions reuse the bounded in-process limiter with a dedicated
game-account bucket and authenticated `userId` key; raw handles are never keys. The process-local
nature remains a documented limitation until shared rate-limit infrastructure exists.

# F4.1 matchmaking HTTP

The API composes `@arena-core/matchmaking` as private session-authenticated user routes and
permission-guarded read-only admin inventory. Writes use the existing origin, JSON body, no-store,
and authenticated-principal rate-limit policies. Database-disabled startup remains healthy;
matchmaking operations fail closed with a safe 503 response.

## F4.2 match HTTP

Private users can list/detail their matches and confirm readiness or cancel before both sides are
ready. Admin inventory/detail requires `matches.read`; void requires `matches.manage` plus a
validated reason. Writes reuse session, origin/JSON, rate-limit, and no-store protections.
Opponent exposure starts only after match creation and is limited to display handle, platform,
side, and ready state. `MATCH_READY_TTL_SECONDS` defaults to 120 seconds. The second matchmaking
acceptance invokes idempotent match creation; accepted proposals without a match remain
recoverable. Database-disabled operations return a safe 503.

# Match evidence and dispute API

Authenticated participant routes are under `/matches/:matchId/evidence` and
`/matches/:matchId/disputes` (including withdraw, respond, and cancel). Admin review is under
`/admin/match-disputes` and requires the read, assign, or review dispute permission.

Write routes reuse session CSRF protection and bounded in-process rate limiting; global API cache
policy is `no-store`. User responses reveal only their own evidence and safe dispute summaries.
Admin responses omit identity credentials and reviewer identifiers. With the database disabled,
these routes fail safely with 503. Evidence is metadata-only: multipart upload and storage URLs are
not supported.

## Wallet routes

Authenticated users can read `/wallet` and `/wallet/ledger`. Administrative wallet
read, issuance, adjustment, reversal, and reconciliation routes live under
`/admin/wallets` and require `wallets.read`, `wallets.issue`, `wallets.adjust`,
`wallets.reverse`, or `wallets.reconcile`. Existing CSRF, no-store, session, and
rate-limit controls apply. ARENA_POINT is explicitly non-monetary. Database-disabled
requests fail closed with a redacted 503.

Settlement user reads are `/matches/:matchId/settlement` and `/match-settlements`.
Admin routes under `/admin/match-settlements` provide bounded read, settle, retry,
reconciliation, and eligible recovery with `match_settlements.*` permissions. Inputs
never accept winner, amount, asset, participant, result, or settlement type.

## Rating and leaderboard routes

Private no-store routes are `GET /ratings`, `/ratings/:gameKey/:modeKey`,
`/ratings/:gameKey/:modeKey/history`, and `/ratings/:gameKey/:modeKey/rank`. The public safe
leaderboard is `GET /leaderboards/:gameKey/:modeKey` with a 30-second public cache and bounded
cursor pagination. Administrative read/apply/retry/reconcile/recovery routes are under
`/admin/ratings` and require `ratings.read`, `ratings.manage`, or `ratings.reconcile`; writes also
require CSRF validation. Inputs never accept winner, outcome, rating, delta, policy, or K-factor.
Database-disabled calls return a redacted `503 RATING_SERVICE_UNAVAILABLE`.

## Notification API

Private user endpoints under `/api/v1/notifications` provide list, unread count, detail,
read/unread and archive operations. `/api/v1/notification-preferences` lists defaults and
updates the current user's per-type overrides. Admin outbox inspection, dead-letter listing,
retry and expired-claim recovery live under `/api/v1/admin/notifications` and require
`notifications.read`, `notifications.retry` or `notifications.manage`.

All routes reuse session authentication, CSRF protection for writes, rate limiting and
`Cache-Control: no-store`. When `DATABASE_ENABLED=false`, authenticated notification calls
return the redacted `NOTIFICATION_SERVICE_UNAVAILABLE` response; no in-memory fallback exists.

# Release candidate

API `0.1.0-rc.1` is included in the F9.4 contract, security, HTTP, and production-build gates.
