# Arena Core launch readiness

## Release candidate

Arena Core `0.1.0-rc.1` is the first integrated release candidate. Because the repository has no
HEAD, its build identity is `uncommitted`; it is not a final production release. The canonical
identity, lockfile SHA-256, image tags, and all 13 migration checksums live in
`release/manifest.json`.

## Capability status

| Capability                                | Owner                         | User/API surface                   | Admin surface              | Persistence                        | Launch status |
| ----------------------------------------- | ----------------------------- | ---------------------------------- | -------------------------- | ---------------------------------- | ------------- |
| Identity, verification, recovery, profile | identity / API                | auth and profile routes            | audit/search               | User, Session, token records       | RC verified   |
| Catalog and player identity               | game-catalog, player-identity | catalog and game accounts          | catalog/account operations | catalog/account models             | RC verified   |
| Matchmaking and match lifecycle           | matchmaking, matches          | requests, proposals, match room    | match operations           | request/proposal/match models      | RC verified   |
| Results, evidence, disputes               | matches                       | result and dispute routes          | resolution API             | result/evidence/dispute models     | RC verified   |
| Wallet, reservation, settlement           | wallet, match-finance         | own-safe finance views             | guarded operations         | append-only ledger/finance models  | RC verified   |
| Rating and leaderboard                    | rating                        | own ratings and public leaderboard | reconciliation API         | rating/history models              | RC verified   |
| Notifications and outbox                  | notifications                 | list/preferences                   | outbox/recovery            | notification/outbox models         | RC verified   |
| Audit, search, timelines, diagnostics     | admin-operations              | none                               | Admin Web and API          | append-only audit plus projections | RC verified   |
| User and Admin Web                        | web                           | public/private routes              | permission-aware `/admin`  | server API clients                 | RC verified   |

“RC verified” means contract, application, HTTP, security, privacy, build, and static release
verification passed. It does not claim live infrastructure verification.

## Golden journeys

Registration, password recovery, profile/player identity, two-user matchmaking, ready/start,
agreed result, conflicting result/dispute, draw, void, notification delivery lifecycle, and Admin
operations are mapped by `tests/product-integration.test.mjs` to the existing application and HTTP
test suites. The gate verifies route composition, idempotency coverage, privacy checks, and release
artifacts without introducing production fakes.

## Security, privacy, and data integrity

- Session, CSRF, permission default-deny, private `no-store`, safe redirects, constrained proxy,
  redaction, and production configuration tests are release gates.
- Settlement, rating, ready/start, proposal acceptance, wallet writes, and notification creation
  retain idempotency or uniqueness coverage.
- The migration chain remains 13 immutable migrations; FC 26 fixture validation is mandatory.
- No production mock, impersonation, manual wallet UI, new result override, Redis, BullMQ,
  WebSocket, SSE, payment, or deployment capability is part of this RC.

## Findings and go/no-go rule

| Severity | Open count | Decision                |
| -------- | ---------: | ----------------------- |
| BLOCKER  |          0 | GO for F10 provisioning |
| HIGH     |          0 | GO for F10 provisioning |
| MEDIUM   |          0 | None recorded           |
| LOW      |          0 | None recorded           |

The official production dependency audit completed online against `registry.npmjs.org` at
`2026-07-27T22:38:07Z`: `pnpm audit --prod` exited 0 with no known vulnerabilities and no automatic
fixes. With all locally executable root gates, manifest verification, and static container checks
passing, the repository is **GO FOR F10 SERVER PROVISIONING**. Provisioning is not production launch
approval.

## Deferred runtime prerequisites

F10 must verify Docker builds and Compose runtime, fresh PostgreSQL migrations and seed, backup and
isolated restore, live SMTP delivery, TLS/domain topology, container vulnerability scanning, and
live smoke tests. These are environment-blocked here and must never be represented as successful.
