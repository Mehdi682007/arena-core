# ADR-0010: Identity data model

- Status: Accepted
- Date: 2026-07-25

## Context

The first executable domain schema must securely support email identity,
credentials, revocable sessions, verification/reset tokens, profiles, and
basic authorization without implementing authentication features. PostgreSQL
is unavailable in the current environment.

## Decision

Keep `User` separate from optional profile, multiple email identities, optional
password credential, sessions, and token records. Authorization uses flat
roles and permissions with explicit join tables; there is no inheritance,
deny, tenancy, or seed data.

Use database-generated random UUIDs for standalone records and composite keys
for joins. PostgreSQL's built-in `gen_random_uuid()` avoids sequential public
IDs and an extension dependency.

Persist only password and token hashes. Sessions are server-side, expiring,
revocable records carrying a security-version snapshot. Email verification
belongs to an email; password reset belongs to a user.

Deletion is a `DELETED` status with `deleted_at`. Ordinary flows never
physically delete users. Owned rows cascade only for controlled erasure,
authorization catalogs restrict deletion, and removed assignment actors become
null.

Normalized email is globally unique. A PostgreSQL partial unique index enforces
one primary email per user because Prisma Schema cannot express it. Migration
checks enforce temporal, non-negative, non-empty, revocation, and deletion
invariants. All instants use `TIMESTAMPTZ(3)`.

Generate `init_identity` using official `prisma migrate diff` from empty, then
minimally augment reviewed SQL with unsupported checks and the partial index.
The migration is committed but not considered applied until real PostgreSQL
verification exists.

## Consequences

The schema supports later application services without making persistence
types API contracts. Multiple-email support and revocable sessions add
transactional invariants. Manual SQL additions require permanent static tests
and review of future Prisma diffs.

Hashing parameters, session duration, normalization implementation, retention,
public usernames, and phone identity remain later decisions.

## Alternatives rejected

- Email/password columns on `User`: conflates boundaries.
- Raw or reversible tokens: unacceptable disclosure impact.
- Auto-increment IDs: guessable public identifiers.
- UUID extension installation: unnecessary on the target PostgreSQL baseline.
- One email per user: blocks verified multi-email identity.
- Application-only primary-email enforcement: race-prone.
- Role inheritance/denies: premature complexity.
- Empty migration, SQLite substitute, or claimed apply: false verification.
