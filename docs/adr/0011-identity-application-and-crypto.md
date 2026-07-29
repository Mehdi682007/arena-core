# ADR 0011: Identity application boundary and cryptography

- Status: Accepted
- Date: 2026-07-25

## Decision

Create `@arena-core/identity` with domain policies, application services, repository/crypto/clock
ports, Node crypto adapters, and a Prisma adapter. Compose it in NestJS without a controller.

Use opaque random tokens stored as domain-separated HMAC-SHA-256 digests, with a separate HMAC key
for IP pseudonymization. Use Node 24's built-in Argon2id implementation with random salts and
encoded parameters. Require verified primary email for login/reset, perform dummy verification for
absent users, and transact token consumption, credential changes, security-version changes, and
session revocation.

## Consequences

Transport can be added without moving security rules into controllers. Database-backed sessions
provide immediate revocation. HMAC key rotation needs a versioned migration strategy. Built-in
Argon2 avoids a native dependency, but its experimental Node API makes runtime compatibility tests
mandatory on upgrades.
