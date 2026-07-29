# Security Baseline

Administrative routes require session authentication and a typed permission. Writes retain
CSRF/origin enforcement. Projections exclude secrets, authentication material, full IP data,
hidden evidence and internal wallet identifiers.

## Match entry integrity

Entry amount and asset come only from the immutable Match snapshot. Ownership is server-enforced.
Conditional user/escrow debits prevent negative balances; movements are double-entry and
idempotent. Automatic refund is pre-start only. Admin operations have separate permissions.
Writes use CSRF and responses are no-store and redacted. No real currency, external provider,
final distribution, or platform share is implemented.

## F4.3 result integrity

Ownership is filtered in repository queries. Opponent submission content is secret from
participant projections until a final result exists. Canonical comparison and winner derivation
use the immutable Match ruleset snapshot. Admin resolution is permission-protected and audited.
Transactional finalization handles races. No evidence claim or financial/Rating effect occurs.

## Catalog administration

Public catalog routes are explicitly public. Administrative routes remain session-authenticated and
use a separate default-deny `games.manage` guard. Writes retain allowed-origin and JSON enforcement
and strict DTOs. Public projections omit IDs, internal states, ordering, timestamps, and drafts.
Ruleset JSON is size/depth bounded and rejects cycles, non-JSON values, non-finite numbers, and
prototype-pollution keys.

## Identity application controls (F2.2)

Identity behavior is centralized in `@arena-core/identity`. Passwords use configurable Argon2id;
opaque tokens are stored only as domain-separated HMAC digests; IP metadata uses a separate HMAC
key. Login performs dummy verification for unknown email and reset requests are enumeration-safe.
Only verified primary emails may authenticate/reset. Sessions check absolute/idle expiry,
revocation, user state, and security-version drift. Password reset/change increments the version
and revokes sessions.

Application lockout does not replace future edge rate limiting. HMAC key rotation, MFA, and
recovery codes remain future work.

Identity email places opaque verification/reset tokens only in URL query parameters constructed by
the platform URL API. Template values are escaped and both HTML and plain-text alternatives are
generated. SMTP errors cross the boundary only as stable typed codes; credentials, provider
diagnostics, recipients, bodies, and tokens are excluded. Verification and reset request responses
remain enumeration-safe even when delivery fails.

## Identity HTTP controls (F2.3)

Authentication accepts only the opaque session cookie. It is HttpOnly, SameSite=Lax and Path=/;
Secure is mandatory in staging/production. Login never returns its token in JSON and logout clears
the cookie with matching attributes. Auth responses are no-store and include nosniff,
no-referrer, and request-ID headers.

Unsafe methods are JSON-only. Strict environments require an exact allowlisted Origin; wildcard,
credential-bearing, and path-bearing origins fail configuration. This complements rather than
replaces CORS. Request bodies default to 16 KiB. DTO errors list fields without echoing passwords or
tokens.

The base limiter is bounded and in-process, keyed only by endpoint and direct IP. It is not suitable
for multi-instance production. Forwarded headers are not trusted; production IP capture remains
disabled until a restricted trusted-proxy policy is configured.

## Identity

- Argon2id password hashing with environment-tuned parameters.
- Short-lived access token and rotating refresh-token families stored as hashes.
- Session listing and revocation.
- Generic registration/login/reset responses to reduce user enumeration.
- Rate limits and progressive cooldown on authentication endpoints.
- Email verification first; phone is an adapter-ready future option.
- 2FA-ready user/session model; implementation deferred.

## Authorization

Roles provide defaults; permissions are independently assigned and checked in backend policy guards. Object-level authorization prevents IDOR. Administration mutations and private evidence reads are audited.

## Application

Strict DTO validation, output shaping, controlled filtering/sorting, CORS allowlist, security headers, request-size limits, CSRF protection when cookie authentication is used, safe file names/object keys, signed URLs, dependency scanning, and secret redaction.

Configuration is allowlisted, typed, immutable, and validated before service bootstrap. Validation messages name variables and constraints but never echo supplied values. CORS uses exact HTTP(S) origins; wildcard is rejected in staging and production. Only the two reviewed `NEXT_PUBLIC_` values may cross the Web server/client boundary. Real environment files and orchestrator secrets remain untracked.

## Data

TLS in transit, managed encryption at rest in hosted environments, least-privilege database/storage credentials, encrypted backups, retention policies, and no passwords, tokens, identity documents, or evidence bodies in logs.

Database URLs are server-only secrets and validation/error reporting must never echo them. Prisma errors are classified into generic internal categories before crossing framework boundaries. Query logging defaults off and remains off in production unless explicitly approved. Runtime roles should receive only application DML privileges; migration roles may receive narrowly scoped DDL privileges and must not be reused by normal processes. PostgreSQL TLS requirements will be finalized with the selected production provider.

## Local infrastructure

The committed passwords are recognizable development-only examples and are never production defaults. Real values belong in the ignored root `.env` or process environment and must not appear in logs or reports. Published Compose ports bind to loopback by default.

The MinIO evidence bucket is initialized with anonymous access disabled. Mailpit intentionally has no TLS or authentication because it only captures local development email; it must never be publicly exposed or used for delivery. Infrastructure images must come from official/upstream publishers and use exact stable tags—floating or prerelease tags are prohibited.

## Threat priorities

Account takeover, credential stuffing, IDOR, wallet replay/races, forged results, evidence malware, moderator abuse, queue denial of service, privacy leakage, and supply-chain compromise.

## Identity persistence security

Email, profile, credentials, sessions, and authorization are separate records.
Password plaintext is never persisted; only a bounded hash and algorithm label
are stored. Algorithm/work-factor selection remains a later decision.

Session, verification, and reset tokens are persisted only as unique hashes
with mandatory expiry. IP values are optional hashes, never raw addresses. The
future keyed-IP design must address key rotation and the guessability of
low-entropy IP inputs.

Normalized email is globally unique and a partial unique index enforces at most
one primary email per user. Future writes must apply one documented
normalization algorithm before persistence.

Account deletion is an explicit `DELETED` state plus timestamp; physical
deletion is not ordinary application behavior. Prisma records containing
password/token/IP hashes require explicit response projection and must never be
logged or returned wholesale.

### Private profile safety

Profile routes are current-user-only and session-protected; no public/cross-user lookup exists.
Responses are `no-store` and minimize personal data. Display names are plain text, trim/NFC
normalized, and reject control, bidi-control, and invisible formatting characters. Future UIs must
escape output. Timezones are canonicalized IANA values; offsets, URLs, and traversal-like values are
rejected. Country is optional preference metadata, not nationality, residence, KYC, tax, sanctions,
currency, or eligibility evidence. Writes reuse JSON/origin CSRF checks. Persistence errors and
disabled DB state map to generic 503 responses, and profile values are not logged.

### Platform identity claims

Game accounts are private and ownership-scoped. Normalized handles and admin notes are never in
user responses; conflicts do not disclose the current claimant. Users cannot self-verify or set a
verification method. Admin actions are permission-checked and append actor-attributed reviews.
No OAuth/access/refresh token or external credential is stored. All writes reuse JSON/origin CSRF
checks and all responses are no-store. Manual verification remains an accepted operational risk.

# F4.1 matchmaking security

The server derives user ownership and game/platform/crossplay references from the authenticated
user's verified account; clients cannot submit priority or override catalog topology. Criteria are
schema-versioned, size bounded, allow-listed to language and region preferences, and reject
financial or prototype-shaped input. User projections conceal opponent identity and internal
matching data. Mutations use session authentication, origin/JSON checks, rate limiting,
transactions, and optimistic versions. Admin inventory is read-only and permission guarded.

# F4.2 match security

Users cannot create matches, add participants, select deadlines, or mutate status. Creation
revalidates accepted proposal state, matched requests, verified ownership, and catalog sources in
a transaction. Unique proposal and optimistic version predicates handle duplicate creation and
ready/cancel races. Snapshots minimize identity data and reject credentials, tokens, email,
IP/session data, normalized handles, and verification metadata. Opponent display handle is exposed
only after a match exists. Admin void is permission guarded and audited. All writes are CSRF/rate
limited; all routes are no-store and persistence errors are redacted.

# F4.4 evidence and dispute security

Evidence is metadata-only and rejects untrusted URLs, paths, binary data, MIME types, checksums, and
storage references. Participant ownership is derived from the session and composite database
constraints. User projections do not disclose the opponent's evidence or reviewer identity.
Reviewer assignment and resolution are permission-protected and audited; result corrections retain
an append-only revision. No evidence causes automatic adjudication, financial settlement, or rating
changes. Writes retain CSRF, rate-limit, `no-store`, and redacted persistence-error behavior.

## Wallet integrity

ARENA_POINT is not money, is not withdrawable, and has no conversion rate. Integer
amounts, balanced immutable entries, ordered account locks, conditional debit updates,
idempotency fingerprints, audit records, and reversal history protect integrity. Users
can read only their own wallet and cannot write balances. Administrative operations
require explicit permissions and use existing CSRF/no-store controls. No payment secret,
provider, webhook, escrow, or match-triggered wallet mutation exists in F5.1.

F5.3 settlement derives winner from the final result and amounts from reservations,
blocks active disputes and delay bypass, posts balanced ledger entries, hides opponent
wallet data, and never deducts a platform fee.

F6.1 derives rating outcome exclusively from the final result, blocks active disputes and the
configured finality delay, atomically locks and updates both ratings, and stores immutable audit
snapshots. Public leaderboards omit user IDs and internal handles. Admin inputs cannot supply
winner, outcome, rating, delta, policy, or K-factor. No wallet, settlement, reward, Redis, or queue
side effect exists.

## Notification privacy

All user reads and state changes are recipient-scoped. Payload validation rejects credentials,
email, session, IP, wallet internals, opponent identifiers and administrative notes. Templates
are server-owned and HTML-escaped. Email requires an active account and verified primary email;
provider errors and recipient addresses are not exposed. Admins may inspect safe delivery state
and retry it, but cannot alter a payload or delivery attempt.

# F8.1 production controls

Production configuration fails fast; secrets are recursively redacted; CORS and proxy trust are
explicit; API security headers/CSP and bounded body/timeouts are global; and operational logs never
serve as administrative audit records. See `production-security.md`.

# F9.3 administrative boundary

Admin navigation consumes only an allowlisted permission projection and is never treated as an
authorization control. Reads are `no-store`; writes retain cookie, Origin, JSON content-type,
timeout and no-retry protections. Audit metadata has a second frontend redaction pass and
notification Outbox responses exclude claim, recipient, payload, deduplication and provider
internals. No privileged identity switching or destructive financial/result action exists.

# Release-candidate security gate

F9.4 requires the existing authentication, CSRF, permission, no-store, proxy, redirect, redaction,
configuration, container, and dependency checks to pass together. Zero unresolved BLOCKER/HIGH
findings is required before F10 provisioning.
