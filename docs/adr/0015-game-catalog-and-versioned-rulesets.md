# ADR 0015: Game catalog and versioned rulesets

- Status: Accepted
- Date: 2026-07-25

## Decision

Game metadata is owned by the framework-neutral `@arena-core/game-catalog` package. It contains
domain policies, application services, repository and transaction ports, and a Prisma adapter.
NestJS remains an edge adapter.

Platforms use a shared catalog with a `GamePlatform` join. Crossplay uses non-overlapping,
game-specific groups: a game-platform can belong to at most one group. Modes are configuration, not
executable scoring. English source fields are temporary; translations can be added later.

Games, shared platforms, game-platform availability, game-specific crossplay groups, modes, and
versioned rulesets are relationally separate. Published rulesets are immutable; a change creates a
new positive version. PostgreSQL partial indexes enforce a single default platform per game and a
single active default ruleset per game/mode.

Public reads expose only active projections and use a 60-second cache with a 300-second
stale-while-revalidate window. Administration is authenticated, CSRF-protected, strict-DTO
validated, non-cacheable, and denied unless the principal has `games.manage`.

The permission foundation also types `games.read`, `platforms.manage`, and `rulesets.manage`; no
permission, role, administrator, platform, or game seed is created. A generic validator registry
allows game-specific validators later without adding FC-specific rules now.

## Consequences

Catalog data evolves without coupling to matchmaking, user game accounts, or finance. A
database-disabled runtime fails safely with `GAME_CATALOG_UNAVAILABLE`. PostgreSQL is the final
authority for cross-game membership, uniqueness, archive consistency, and defaults.

## Alternatives rejected

A platform-per-game model duplicates metadata. Pairwise crossplay matrices are harder to administer
for the MVP. Mutable publication destroys historical meaning. Hard-coded game schemas prevent a
game-agnostic core. Seeding FC data here would mix deployment content with schema foundation.
