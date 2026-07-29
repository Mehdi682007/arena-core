# ADR-0022: Wallet ledger and non-monetary balance

Status: Accepted

## Context and decision

Arena Core needs an auditable balance foundation before any future settlement work. F5.1
therefore supports only `ARENA_POINT`, an internal non-monetary and non-withdrawable
asset with no conversion rate or guaranteed cash value.

Each user has at most one lazily-created Wallet and one available account per asset.
System issuance and adjustment accounts have no user. Amounts are positive `BIGINT`
values. Credit increases and debit decreases the user projection. Each posted
transaction atomically writes equal debit and credit totals, updates locked account
projections, and records an audit event. User projections cannot be negative.

Posted entries are immutable. Corrections use a linked reversal. Operation keys and
canonical request fingerprints make retries idempotent and conflicting reuse explicit.
Reconciliation derives the balance from entries, compares it with the cached projection,
records the outcome, and performs no automatic repair.

## Consequences

The domain and application layers remain independent of NestJS and Prisma; PostgreSQL is
accessed through the repository adapter. Match, result, and dispute flows have no wallet
side effects. Payment providers, deposits, withdrawals, transfers, real-money assets,
escrow, fees, prizes, refunds, Redis, and queues remain outside this decision.

Alternatives rejected were floating-point amounts, mutable entries, direct balance
updates, single-entry accounting, user-issued points, and treating a test adapter as
persistent storage.
