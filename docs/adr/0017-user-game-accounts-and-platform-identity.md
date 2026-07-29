# ADR-0017: User game accounts and platform identity

- Status: Accepted
- Date: 2026-07-25

## Context

Users need private claims connecting their Arena identity to a game and one valid GamePlatform,
without introducing provider integrations or coupling authentication to competition features.

## Decision

Create the separate `@arena-core/player-identity` boundary. `UserGameAccount` references User,
Game, and the composite `(GamePlatform.id, GamePlatform.gameId)`. Active claims are unique by
user/platform and platform/normalized handle. A partial unique index permits at most one primary
account per user/game, and only verified accounts qualify.

Use a conservative generic Unicode NFC/lowercase normalizer until provider rules are sourced.
Lifecycle is explicit and physical deletion is not an ordinary operation. Admin actions use only
manual verification and append an immutable `GameAccountReview` with actor and reason. User and
admin HTTP surfaces remain private, no-store, CSRF-protected, and permission guarded.

No OAuth tokens, external credentials, provider SDK/API, account seed, public projection, UI, or
automatic verification is introduced.

## Consequences

PostgreSQL partial indexes are expressed in the migration SQL because Prisma Schema cannot model
them. Normalizer changes need deliberate versioning and collision analysis. Real ownership
verification and provider linking remain future decisions.

Alternatives rejected: storing platform credentials, generic CRUD, authentication-context
ownership, overwritable review columns, physical deletion, and selecting a primary account from
the catalog default platform.
