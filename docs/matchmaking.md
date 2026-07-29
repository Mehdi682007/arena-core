# Matchmaking

## Compatibility dimensions

Game, game mode, rule-set version, platform/crossplay policy, entry-fee amount and currency, region/latency bucket, rating band, trust threshold, and queue status.

## Flow

1. Validate user eligibility, verified game account, wallet availability, and no conflicting active ticket.
2. Persist ticket in PostgreSQL; enqueue candidate search.
3. Select candidates using controlled widening of rating/time thresholds.
4. Lock candidate ticket rows transactionally and create a proposed match.
5. Require both users to accept before deadline.
6. Atomically lock test credits and move match to `READY`.
7. Decline/timeout releases reservations and requeues only when policy permits.

Redis may accelerate candidate discovery but PostgreSQL uniqueness and row/version checks decide ownership. Queue processing is at-least-once and replay-safe.

## Abuse controls

Rate limits, repeated-opponent detection, self-match prevention, device/network risk signals as future inputs, trust thresholds, cooldowns, and audited manual intervention.
