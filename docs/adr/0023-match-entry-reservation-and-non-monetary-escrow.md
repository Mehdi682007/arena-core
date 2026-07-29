# ADR-0023: Match entry reservation and non-monetary escrow

## Status

Accepted for F5.2.

## Context

Entry must reserve non-withdrawable `ARENA_POINT` before Ready without coupling Matches to Prisma
or Wallet internals. Existing FC26 rulesets have no non-zero requirement and remain unchanged.

## Decision

Create `@arena-core/match-finance`. It derives a version-1 requirement from the immutable Match
ruleset snapshot, records one immutable-amount reservation per participant, and posts required
value from `USER_AVAILABLE` to `MATCH_ESCROW` keyed by `match_escrow:<matchId>`.

Ready and start depend on a framework-neutral eligibility port. Start releases reservation state
without ledger movement. Refund is a separate balanced transaction allowed only before start for
cancellation, expiry, void, or bounded operational recovery. Fingerprints and unique keys provide
replay safety. Reconciliation reports drift without repair.

No final distribution, platform share, external provider, real currency, queue, scheduler, or
background worker is introduced.

## Consequences

Reservation and ledger history are auditable and match-specific. Final distribution, post-start
void/dispute behavior, and recovery automation remain future decisions. PostgreSQL operations
share a transaction context and unavailable persistence fails closed.

## Alternatives rejected

- Reserving during Match creation couples creation to one user's balance.
- Client-provided amount/asset violates snapshot authority.
- Reversal would erase the meaning of a historically valid reservation.
- Moving value on release would prematurely implement final distribution.
