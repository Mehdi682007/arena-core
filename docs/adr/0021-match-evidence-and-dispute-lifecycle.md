# ADR-0021: Match evidence and dispute lifecycle

## Status

Accepted — F4.4.

## Context

Completed or conflicted matches need a game-agnostic, auditable arbitration foundation without
introducing file storage, automatic adjudication, financial settlement, or rating effects.

## Decision

`@arena-core/matches` owns evidence declarations and disputes behind a repository port. Evidence
stores only versioned metadata (`type`, optional description and capture time); it never accepts a
URL, path, blob, MIME type, checksum, size, or storage key. Evidence is participant-owned,
withdrawable while active, and immutable after it is locked into a claim or response.

Only one `OPEN`, `AWAITING_RESPONSE`, or `UNDER_REVIEW` dispute may exist per match. Opening is
limited to `COMPLETED` and `RESULT_CONFLICT` within a configured window and snapshots the bounded
result context. The opposing participant may append one response before its deadline.

Reviewers self-assign; reassignment to another reviewer is rejected. Resolution is permitted only
to the assigned reviewer from `UNDER_REVIEW`. Supported decisions are uphold, correct result, void
match, and reject. Correction or voiding writes an append-only `MatchResultRevision` in the same
transaction before changing the result. Expiration only advances overdue responses to review; it
never picks a winner or resolves a dispute.

All writes are audited. The user API exposes only the user's evidence and a safe dispute summary.
Admin routes require `match_disputes.read`, `match_disputes.assign`, or
`match_disputes.review`.

## Consequences

- PostgreSQL enforces participant ownership, one active dispute, one response, and one revision per
  resolved dispute.
- A future storage service may attach through a separate boundary; F4.4 contains no placeholder
  upload contract or SDK.
- A future settlement/rating component may react after resolution, but no wallet, rating,
  notification, queue, scheduler, or automatic decision is implemented here.
- Without PostgreSQL, persistence-dependent routes fail safely with 503 and runtime migration
  verification remains blocked.

## Alternatives rejected

- Arbitrary evidence URLs or local paths: unsafe and unverifiable.
- In-memory runtime persistence: not durable and misleading.
- Automatic no-show/score adjudication: insufficient evidence and outside this foundation.
- Silent result overwrite: destroys arbitration history.
- User-selected reviewers or winners: privilege escalation.
- Redis queues or worker polling: unnecessary for the bounded lifecycle.
