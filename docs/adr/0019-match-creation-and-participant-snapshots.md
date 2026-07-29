# ADR-0019: Match creation and participant snapshots

- Status: Accepted
- Date: 2026-07-26

## Context

An accepted matchmaking proposal records mutual intent but is not a durable competition match.
The platform needs a separate, game-agnostic lifecycle without prematurely introducing results,
evidence, disputes, finance, or asynchronous infrastructure.

## Decision

Create `@arena-core/matches`. Only an `ACCEPTED` proposal whose two requests are `MATCHED` and
whose accounts remain verified can create a match. `Match.matchmakingProposalId` is unique.
Creation re-reads all source records in a short transaction, snapshots the published catalog and
participant labels, creates exactly two sides, enters `AWAITING_READY`, and appends `CREATED`.
A uniqueness loser returns the existing match, giving idempotent exactly-once semantics.

Use two-step orchestration: the API invokes creation after the second acceptance, while the
accepted proposal remains unchanged if creation fails. A bounded recovery use case finds accepted
proposals without matches. It is not scheduled or run at startup.

Store versioned, bounded JSON snapshots on Match and MatchParticipant. Snapshots reject sensitive
identity and credential fields. After match creation each participant may see the opponent's
display handle, platform, side, and readiness, but never opponent user/account IDs.

Ready is transactional and idempotent; both ready participants move the match to `READY`. A user
may cancel only before `READY`. Unready matches can expire after a server-only deadline. Admin
voids require an explicit reason and append an immutable audit event.

## Consequences

Historical matches no longer depend on mutable catalog labels or handles. Snapshot schema changes
need versioned readers. PostgreSQL is needed to prove unique and race behavior at runtime. Match
start, results, evidence, disputes, penalties, wallets, ratings, notifications, realtime delivery,
and team/2v2 participant modeling remain future work.

Alternatives rejected: user-created matches, mutable live joins, consuming proposal status,
duplicating match ID on the proposal, synchronous external calls, startup recovery, background
polling, and adding result or financial fields early.
