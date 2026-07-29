# ADR-0018: Matchmaking requests and compatibility

- Status: Accepted
- Date: 2026-07-25

## Context

Arena Core needs a game-agnostic way to register a player's intent, evaluate compatible opponents,
and collect two short-lived acceptances before a real match exists. The foundation must preserve
catalog authority and player-account ownership without introducing asynchronous infrastructure.

## Decision

Create the independent `@arena-core/matchmaking` boundary. Persist immutable catalog/account
references on each request, bounded versioned criteria, explicit request/proposal states, TTLs, and
optimistic versions. Allow one active request per user and one pending proposal per request.
Canonical proposal pairs, partial unique indexes, composite foreign keys, checks, and a
PostgreSQL trigger protect invariants that Prisma Schema cannot express.

Compatibility is a pure function. Game, mode, ruleset, crossplay group, request state, TTL, account
verification, and catalog validity are hard gates. Search scope can require the same platform.
Language, region, and same-platform affinity are deterministic soft bonuses only. Candidate
queries are bounded; final ordering is score descending, request age ascending, then ID.

Proposal acceptance, rejection, cancellation, expiry, and request restoration run through
transaction ports. Two acceptances produce an accepted proposal and `MATCHED` requests, not a
`Match`. HTTP surfaces are authenticated, no-store, CSRF protected for writes, rate limited, and
use privacy-safe projections. Admin inventory is read-only and permission guarded.

## Consequences

F4.2 can consume an accepted proposal to create a match. Redis, BullMQ, background polling,
real-time delivery, rating, wallet, and external game APIs remain outside this decision. Static SQL
and adapter tests do not prove PostgreSQL runtime transaction or constraint behavior; that gate
remains blocked until a real PostgreSQL runtime is available.
