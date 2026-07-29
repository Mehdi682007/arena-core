# `@arena-core/rating`

This package owns the framework-neutral rating, ranking, leaderboard, and reconciliation
foundation. A rating scope is `User + Game + GameMode + CrossplayGroup + policy key/version`;
compatible platforms therefore share a rating. Platform filtering is intentionally deferred until
a non-ambiguous platform dimension exists.

Elo policy `ELO/1` persists integer ratings. It uses divisor 400, `Math.round`, configurable initial
and bounded minimum/maximum values, K=40 for the first 10 matches and K=24 afterward by default.
Clamping can make the pair delta non-zero at a bound and is recorded in each immutable calculation
snapshot.

`RatingService.applyMatchRating` derives WIN/LOSS/DRAW from the final result, requires COMPLETED
plus CONFIRMED/ADMIN_RESOLVED, blocks active disputes and enforces the configured delay. It
lazy-creates two scoped ratings, deterministically locks them, writes two immutable history rows and
one idempotent application in one transaction. An exact retry returns the prior application;
conflicting reuse fails. Settlement presence does not affect eligibility, and rating never imports
or mutates wallet, settlement, reward, or prize state.

Leaderboard ordering is rating DESC, matches played DESC, wins DESC, updated time ASC, stable ID
ASC. Public projections omit user IDs, normalized handles, opponent identity, calculation
snapshots, and all financial fields. Reconciliation replays ordered history and only reports drift;
it never auto-fixes. Recovery is bounded and explicitly invoked—there is no scheduler or worker.

When the database is disabled the API still registers all routes and fails closed with
`RATING_SERVICE_UNAVAILABLE`; no runtime in-memory store is installed.
