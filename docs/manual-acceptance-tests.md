# Manual acceptance test plan

Run against private staging with synthetic accounts. Record request IDs and screenshots without
capturing tokens, passwords, full emails, private evidence, or internal financial identifiers.

## User journeys

- Register, receive verification, verify, log in, and reach onboarding/dashboard.
- Request password recovery, confirm generic response, reset, and log in only with the new password.
- Update profile; add a supported game identity; confirm rejected/suspended identities are ineligible.
- Create two compatible matchmaking requests; accept proposal from both accounts; verify one match.
- Ready both participants; verify one reservation and one start despite duplicate clicks.
- Submit and confirm an agreed result; verify settlement, rating, leaderboard, and notifications.
- Submit conflicting results; open/respond to dispute; resolve through existing Admin API; verify final state.
- Exercise draw and void paths; verify non-negative own-safe amounts and rating policy.
- Read/archive notifications and verify unread count and safe deep links.
- Log out and confirm private routes redirect.

## Admin journeys

- Confirm unauthenticated, no-permission, and permission-limited access behavior.
- Filter Audit, open immutable detail, and verify metadata redaction.
- Search each supported scope and open safe User/Match timelines.
- Inspect Outbox and Dead-letter; retry an eligible message with confirmation.
- Run supported recovery with a valid source and reject an arbitrary source type.
- Refresh diagnostics and verify no environment dump, connection string, secret, or filesystem path.

## Operations

- Verify API liveness/readiness and Web health.
- Apply migrations to a fresh database and validate seed.
- Create a backup; restore into an isolated database; compare expected counts/checks.
- Send SIGTERM and verify readiness drains before graceful shutdown.
- Run release preflight, artifact verification, staging smoke, and rollback rehearsal.
