# Dispute Resolution

## Workflow

`OPEN → UNDER_REVIEW → RESOLVED_WINNER | RESOLVED_REFUND | REJECTED`

Players can open or supplement a dispute within configured deadlines. Moderators see submissions, evidence metadata, match/rule snapshots, and prior actions. A resolution requires a reason code and note, records the reviewer and permissions, emits an audit event, and triggers settlement/refund through an idempotent command.

## Controls

- Reviewer cannot be a match participant.
- Evidence access is logged.
- Outcome changes require explicit permission.
- Reopening requires elevated permission and uses compensating financial entries when already settled.
- Concurrent resolution attempts use aggregate version checks and a unique terminal action.
- Player-facing views reveal decisions but not internal risk signals.
