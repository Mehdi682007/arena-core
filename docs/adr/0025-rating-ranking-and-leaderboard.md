# ADR-0025: Rating, ranking, and leaderboard

Status: Accepted

## Context

Arena Core needs deterministic competitive ratings after a match becomes final, without coupling
rating to matchmaking, wallet, settlement, rewards, or a background processor.

## Decision

Rating scope is User + Game + GameMode + CrossplayGroup and immutable policy identity. Platform
compatible players share a scope. A future platform filter is deferred because verified accounts
can span compatible platforms and no authoritative per-rating platform dimension exists.

F6.1 adopts versioned Elo `ELO/1`: divisor 400, integer inputs and persistence, final
`Math.round`, configurable bounds, initial 1000, provisional K=40 for ten matches, then K=24.
Bounds clamp each participant independently; the snapshot makes any boundary non-zero-sum effect
auditable.

Only COMPLETED matches with CONFIRMED or ADMIN_RESOLVED results and exactly two participants are
eligible. Outcome is derived from MatchResult. Active disputes block application. Normal results
wait for the configured 24-hour finality delay; a terminal admin-resolved dispute can be rated
immediately. Settlement and rating remain independent.

One MatchRatingApplication per match and unique request fingerprints provide idempotency.
PlayerRating and its two PlayerRatingChange rows are written atomically after deterministic row
locking. Changes are immutable; reversal is represented in schema but full reversal is deferred.
Once applied, opening a dispute or correcting/voiding the result is rejected.

Public leaderboard ordering is rating DESC, matchesPlayed DESC, wins DESC, updatedAt ASC, id ASC.
Only active users with a verified account and the minimum match count appear. Cursor pagination
uses a stable ID and projections omit internal identities. Reconciliation replays history,
reports drift, and never auto-fixes. Recovery is bounded and manually invoked.

## Consequences

Ratings remain reproducible and auditable, at the cost of transaction locking and explicit
reconciliation. Crossplay-group scope avoids platform fragmentation. No Season model is introduced;
season filtering remains a future extension. There is no wallet/reward side effect, Redis, queue,
scheduler, or runtime fallback store.

## Alternatives rejected

- Per-platform ratings: fragments compatible competition.
- Mutable history or direct admin rating inputs: not auditable.
- Applying before result finality: can conflict with disputes and corrections.
- Coupling to settlement or rewards: violates independent domain boundaries.
- Redis leaderboard or background polling: unnecessary infrastructure for this foundation.
