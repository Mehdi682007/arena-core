# Product Requirements

## Product

A game-agnostic competition platform. FC26 is seed data for validation, not a hard-coded product boundary. Administrators configure games, platforms, modes, crossplay, rule sets, evidence requirements, deadlines, fees, and rating behavior.

## MVP outcome

Two verified users can register compatible game accounts, receive test credits, enter matchmaking, accept a match, lock entry credits, submit results and screenshots, resolve agreement or dispute, settle once, and view match, rating, reputation, and ledger history. Sensitive actions are audited.

## Primary actors

- Player
- Support
- Moderator
- Administrator
- Super administrator
- Background worker

## In scope

- Identity, sessions, profile, preferences, roles, permissions
- Configurable games/platforms/modes/crossplay/rule sets and FC26 seed
- Game accounts
- Test-credit wallet and immutable ledger
- Matchmaking queue and acceptance
- Match state machine and deadlines
- Dual result submission and evidence
- Disputes and administrator resolution
- Idempotent settlement, refund, commission
- Elo rating and reputation events
- Single-elimination tournaments of 4, 8, or 16 players
- Notifications, audit logs, feature flags
- Persian and English, RTL/LTR
- Public pages, player dashboard, and administration UI

## Explicitly out of scope

Real deposits/withdrawals, live payment gateways, OCR/AI result recognition, video processing, direct game APIs, mobile/desktop apps, team 5v5, battle-royale tournaments, complex leagues, full chat/voice, marketplace, affiliates, and white-labeling.

## Non-functional requirements

- Type-safe and testable code
- Backend authorization and input validation
- Atomic financial operations and replay safety
- UTC persistence and user-timezone display
- Structured logs without secrets or private evidence
- Accessible responsive dark-first UI
- Health/readiness endpoints and migration visibility
- Environment-variable configuration and secret-free repository

## Success criteria

The 20-step acceptance journey specified by the requester passes as an automated E2E scenario, including divergent results leading to a dispute and proof that settlement cannot execute twice.
