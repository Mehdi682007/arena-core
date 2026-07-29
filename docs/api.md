# API Design

The F7.2 audit, safe search, user/match timeline and notification support routes are documented in
[`administrative-operations.md`](administrative-operations.md).

## Match entry reservation

- `GET|POST /api/v1/matches/:matchId/entry-reservation`: current participant only; POST accepts
  only `idempotencyKey`.
- `GET /api/v1/match-entry-reservations`: bounded current-user list.
- Admin inventory, refund, reconcile, and recovery operations live under
  `/api/v1/admin/match-finance`.

Views contain Match, lifecycle, `ARENA_POINT` metadata, amount, and public timestamps only.
Persistence failures map to `MATCH_FINANCE_SERVICE_UNAVAILABLE`.

## F4.3 result API

Participants can start, submit, withdraw and read a safe result projection under `/matches`.
The strict DTO accepts schema version 1, type SCORE and two side scores. Winner, status,
timestamps and ruleset configuration are never accepted. Admin conflict routes require
`match_results.read` or `match_results.resolve`; disabled persistence returns a redacted 503.

## Game catalog (F3.1)

Anonymous reads are `GET /api/v1/catalog/games`, `GET /api/v1/catalog/games/:slug`, and
`GET /api/v1/catalog/games/:slug/rulesets/default`. Successful responses use `Cache-Control:
public, max-age=60, stale-while-revalidate=300` and contain only active public projections.

Administration is under `/api/v1/admin/catalog`, requires a session and `games.manage`, inherits
origin/JSON CSRF controls, validates strict DTOs, and is always `no-store`. Disabled persistence
returns HTTP 503 with `GAME_CATALOG_UNAVAILABLE`; health remains available.

Identity is exposed through strict JSON endpoints. It uses an opaque HttpOnly cookie and never
returns session, verification, or reset tokens in JSON. F2.4 dispatches verification and reset
messages through the email boundary.

Base path: `/api/v1`. REST resources use JSON. OpenAPI generation remains deferred.

## Identity routes

| Method | Path                               | Access    | Success              |
| ------ | ---------------------------------- | --------- | -------------------- |
| POST   | `/auth/register`                   | Public    | 201                  |
| POST   | `/auth/login`                      | Public    | 200 + session cookie |
| POST   | `/auth/logout`                     | Protected | 204 + clear cookie   |
| POST   | `/auth/logout-all`                 | Protected | 204 + clear cookie   |
| POST   | `/auth/email-verification/request` | Public    | 202                  |
| POST   | `/auth/email-verification/confirm` | Public    | 204                  |
| POST   | `/auth/password-reset/request`     | Public    | 202                  |
| POST   | `/auth/password-reset/confirm`     | Public    | 204 + clear cookie   |
| POST   | `/auth/password/change`            | Protected | 204 + clear cookie   |
| GET    | `/auth/me`                         | Protected | 200                  |

Every auth response is `no-store`. Unsafe methods accept `application/json` only and enforce the
configured Origin policy. Validation details contain field names but never supplied values.
Verification/reset request responses are enumeration-safe. Invalid/expired/consumed public tokens
all map to `INVALID_OR_EXPIRED_TOKEN`. Database-disabled operations map to
`503 IDENTITY_SERVICE_UNAVAILABLE`.

Registration returns `deliveryStatus: "sent" | "pending"`. A typed SMTP failure after persistence
produces `pending` rather than rolling back the account. Verification and password-reset requests
continue to return the same `202` response on typed delivery failures.

Technical endpoints currently include database-independent `GET /health` and `GET /health/ready`. Readiness reports only `disabled`, `up`, or `down` for PostgreSQL and returns HTTP 503 for `down`; it never exposes connection or driver details.

## Conventions

- Opaque IDs and ISO-8601 UTC timestamps.
- Cursor pagination for event/history feeds; bounded page pagination for admin catalogs.
- Explicit allowlists for filters and sort fields.
- `Idempotency-Key` required for wallet adjustments, match acceptance with fund lock, settlement, refund, and dispute resolution.
- Request and correlation IDs returned in headers and errors.
- Optimistic concurrency via version/ETag on sensitive resources.

## Error shape

```json
{
  "error": {
    "code": "MATCH_INVALID_STATE",
    "message": "Localized client-safe message",
    "details": {},
    "requestId": "opaque-id"
  }
}
```

## Resource groups

`auth`, `users/me`, `games`, `game-accounts`, `rule-sets`, `matchmaking/tickets`, `matches`, `results`, `evidence`, `disputes`, `wallet`, `wallet/transactions`, `tournaments`, and permission-protected `admin`.

Internal domain errors map centrally to stable public codes. Stack traces and sensitive identifiers never enter responses.

Identity tables are internal persistence details. Prisma-generated types are
not public API contracts and must not be serialized directly. F2.1 adds no
registration, login, logout, session, user, or administration endpoint.

## Private profile and onboarding

| Method | Path                          | Access  | Input                  | Output                    | CSRF/cache              |
| ------ | ----------------------------- | ------- | ---------------------- | ------------------------- | ----------------------- |
| GET    | `/api/v1/profile`             | Session | none                   | Safe profile + onboarding | no-store                |
| PATCH  | `/api/v1/profile`             | Session | Strict partial profile | Updated safe profile      | Origin + JSON; no-store |
| GET    | `/api/v1/onboarding`          | Session | none                   | Derived status            | no-store                |
| POST   | `/api/v1/onboarding/complete` | Session | `{}`                   | Idempotent derived status | Origin + JSON; no-store |

Responses exclude profile ids, credentials, tokens, security version, and session metadata. Empty or
unknown PATCH fields are rejected. Incomplete onboarding returns `409`; invalid profile data returns
`422`; disabled persistence returns sanitized `503 PROFILE_SERVICE_UNAVAILABLE`.

## Private game accounts

User routes: `GET/POST /api/v1/game-accounts`, `GET /:accountId`, and POST actions
`disconnect`, `primary`, and `resubmit`. Admin routes under `/api/v1/admin/game-accounts` list/get,
verify/reject/suspend/restore/disconnect, and expose private review history. Inputs are strict,
UUID-validated JSON; writes require allowed Origin. Responses are no-store and never include
normalized handles, verification metadata, review notes in user views, credentials, or owner
identity in conflict errors. Status/availability errors map to 404/409/422/503.

# Private matchmaking API (F4.1)

- `GET|POST /api/v1/matchmaking/requests`
- `GET /api/v1/matchmaking/requests/:requestId`
- `POST /api/v1/matchmaking/requests/:requestId/cancel`
- `GET /api/v1/matchmaking/proposals/current`
- `POST /api/v1/matchmaking/proposals/:proposalId/accept`
- `POST /api/v1/matchmaking/proposals/:proposalId/reject`
- `GET /api/v1/admin/matchmaking/requests`
- `GET /api/v1/admin/matchmaking/proposals`

All routes require a session and return `Cache-Control: no-store`. Writes require the normal
origin/JSON protections and authenticated-principal rate limiting. Admin routes require
`matchmaking.read`. Proposal responses exclude opponent identity, handles, criteria, score, and
internal request IDs. With persistence disabled, operational routes fail closed with
`MATCHMAKING_UNAVAILABLE`.

# Private match API (F4.2)

- `GET /api/v1/matches`
- `GET /api/v1/matches/:matchId`
- `POST /api/v1/matches/:matchId/ready`
- `POST /api/v1/matches/:matchId/cancel`
- `GET /api/v1/admin/matches`
- `GET /api/v1/admin/matches/:matchId`
- `POST /api/v1/admin/matches/:matchId/void`

All require a session and are no-store. User reads are participant-scoped. Writes require strict
JSON, origin protection, and rate limiting. Admin reads require `matches.read`; void requires
`matches.manage`. Deadline expiry maps to 410, state/race conflicts to 409, missing ownership to
404, validation to 400/422, and unavailable persistence to a redacted 503. Opponent user/account
IDs and internal proposal/request IDs never appear in user responses.

# F4.4 match evidence and disputes

- `GET|POST /matches/:matchId/evidence`
- `POST /matches/:matchId/evidence/:evidenceId/withdraw`
- `GET|POST /matches/:matchId/disputes`
- `GET /matches/:matchId/disputes/:disputeId`
- `POST /matches/:matchId/disputes/:disputeId/respond|cancel`
- `GET /admin/match-disputes` and `GET /admin/match-disputes/:disputeId`
- `POST /admin/match-disputes/:disputeId/assign-self|start-review|resolve`

Inputs are strict and reject upload/storage fields. Participant ownership is server-derived.
Writes require the existing session/CSRF controls; admin operations additionally require dispute
permissions. Responses are `no-store`, avoid opponent evidence disclosure on participant routes,
and return a redacted 503 error when database persistence is disabled.

## Wallet API

- `GET /wallet` and `GET /wallet/ledger` read only the authenticated user's wallet.
- `GET /admin/wallets/:userId` requires `wallets.read`.
- `POST /admin/wallets/:userId/issue` requires `wallets.issue`.
- `POST /admin/wallets/:userId/adjust` requires `wallets.adjust`.
- `POST /admin/wallets/transactions/:transactionId/reverse` requires `wallets.reverse`.
- `POST /admin/wallets/:userId/reconcile` requires `wallets.reconcile`.

Amounts are canonical positive integer strings. Admin writes require the existing session,
CSRF, rate-limit, permission, and no-store controls. Responses describe ARENA_POINT only;
system accounts and internal notes are not exposed. DB-disabled operations return a
redacted `WALLET_SERVICE_UNAVAILABLE` response.

Settlement user reads are `/matches/:matchId/settlement` and `/match-settlements`.
Admin read, settle, retry, reconcile, and recovery routes are under
`/admin/match-settlements`; winner and accounting amounts are always server-derived.

Rating self-service reads are `/ratings`, `/ratings/:gameKey/:modeKey`, history, and rank. The
public `/leaderboards/:gameKey/:modeKey` returns safe player display fields with a 30-second cache.
Admin routes under `/admin/ratings` provide bounded inspection, derived application/retry,
reconciliation, and eligible recovery. Private/admin responses are no-store and DB-disabled calls
fail with a redacted 503.

## Notifications

Authenticated users use `/notifications` for pagination, unread count, detail, read/unread and
archive, and `/notification-preferences` for lazy preference overrides. Permission-gated
administrators use `/admin/notifications/outbox`, its detail/dead-letter/retry routes and
`/admin/notifications/recovery/claims`. Writes retain the shared CSRF/rate-limit policy and
all private responses are emitted with the existing no-store middleware.

`POST /admin/notifications/recovery/sources` reconstructs a supported source event from final
persisted state. It is admin-only, strict, rate-limited and idempotent.

# Platform endpoints and response policy

Every API response receives request/correlation IDs and baseline security headers. Liveness is
`GET /api/v1/health`, readiness is `GET /api/v1/health/ready`, and safe diagnostics are
`GET /api/v1/admin/diagnostics` with `diagnostics.read`. Unknown production errors are normalized
without internal messages or stacks.

# Administrative Web integration

`GET /admin/capabilities` returns only the existing allowlisted Admin permission keys assigned to
the authenticated session. It is read-only and grants no authority. Admin Outbox list/detail/retry
responses use an explicit operational projection and exclude recipient IDs, payload snapshots,
claim tokens, deduplication keys and provider internals. All Admin responses remain private and
`no-store`; all writes retain Origin and JSON-only CSRF validation.

# Release-candidate contract status

F9.4 validates Web consumers against registered API controllers and retains HTTP contract tests for
authentication, DTO validation, CSRF, permissions, caching, safe projections, and error handling.
