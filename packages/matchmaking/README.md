# Matchmaking

`@arena-core/matchmaking` owns the game-agnostic request, compatibility, candidate-selection, and
temporary proposal lifecycle. Domain and application code do not depend on NestJS or Prisma.

A request is derived from a verified user game account and active catalog records. Hard
compatibility requires the same game, mode, active ruleset, and official crossplay group; a
`SAME_PLATFORM` request additionally requires the same platform. Language, region, and same
platform only contribute deterministic soft-score bonuses. Candidates are bounded and ordered by
score, oldest request, then ID.

Only one active request per user and one active proposal per request are permitted. Proposals are
canonical pairs with a short TTL. Rejection or expiry restores requests whose TTL remains; both
acceptances mark the proposal accepted and the requests matched. F4.1 deliberately creates no
`Match`, queue, worker loop, wallet, rating, or external-provider integration.

The public user projection never reveals opponent identity, criteria, score, internal request IDs,
or account handles. PostgreSQL constraints are represented in the F4.1 migration, but runtime
transaction and constraint verification requires a real PostgreSQL service.
