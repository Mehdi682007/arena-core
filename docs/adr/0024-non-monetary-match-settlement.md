# ADR 0024: Non-monetary match settlement

## Status

Accepted.

## Context

Released match-entry reservations leave ARENA_POINT in a match-specific escrow account. A final result needs an immutable, auditable and retry-safe settlement without introducing cash value, providers, fees or asynchronous infrastructure.

## Decision

- Settlement remains inside `@arena-core/match-finance` and supports ARENA_POINT only.
- A confirmed result becomes eligible after `MATCH_SETTLEMENT_DELAY_SECONDS` (default 86400). A terminal admin-resolved dispute may use its resolution time immediately.
- Active disputes block settlement. A dispute cannot be opened and a result cannot be corrected after settlement.
- Winner settlement debits the complete match escrow and credits the result-derived winner.
- Draw and void settlement refund each participant's actual reservation amount.
- No platform fee, commission, retained amount, point issuance or real-money payout exists.
- Ledger posting, settlement creation and reservation finalization share one database transaction.
- A unique match constraint prevents duplicate settlement; an idempotency fingerprint binds match, result revision, type and total.
- Recovery is explicit and bounded. Reconciliation is read-only and never auto-fixes data.
- Scheduling, queues and background workers are deferred.

## Consequences

Settlement is deterministic and auditable, but automatic execution requires later infrastructure. PostgreSQL remains the source of concurrency truth.

## Alternatives rejected

- Immediate settlement, because it erases the dispute window.
- User/admin supplied winner or amount, because result and reservations are authoritative.
- Direct wallet balance updates, in favor of balanced ledger entries.
- Fee deduction or cash payout, because they are outside the non-monetary boundary.
