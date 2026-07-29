# ADR-0020: Match result submission and confirmation

## Status

Accepted for F4.3.

## Context and decision

Match start and result handling stay inside the game-agnostic Matches boundary. Either
participant may idempotently start a READY match. Start records server time and a bounded
submission deadline.

Each participant submits a canonical, version-1 score payload. Historical submissions are
immutable: changing a result supersedes the prior record. Validation uses the ruleset snapshot
captured by the Match, never the live catalog. Scores are ordered by side, bounded to 0..99 and
the outcome is derived. The ruleset snapshot controls whether a draw is allowed.

Two equal canonical submissions atomically create one confirmed MatchResult and complete the
Match. Different submissions create a conflict without selecting a winner. An administrator
with `match_results.resolve` may resolve only a conflict, using a validated canonical result,
typed reason and append-only audit event.

No submission at deadline voids the Match. A single submission at deadline becomes a conflict;
it never creates an automatic winner. Conflict deadline expiry does not automatically adjudicate.

## Consequences

- Opponent submission contents remain hidden from participant projections until finalization.
- Winner, loser and draw are derived server-side and belong only to the final result.
- Result finalization is transaction and optimistic-version protected.
- Evidence, full disputes, arbitration, Wallet, rewards and Rating are deliberately absent.

## Alternatives rejected

- Mutable submissions: destroys review history.
- User-supplied winner identifiers: permits ownership forgery.
- Live catalog validation: creates ruleset drift for existing matches.
- Automatic win from a single submission: lacks independent confirmation.
- Evidence placeholders or platform API claims: those capabilities do not exist in F4.3.
