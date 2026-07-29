# `@arena-core/identity`

Framework-neutral services for registration, password authentication, email verification, password
reset/change, and opaque database-backed sessions.

## Boundaries and security contract

- Domain/application code depends on ports, not NestJS or HTTP. Nest composition in `apps/api` has
  no F2.2 controller.
- `PrismaIdentityRepository` persists state; multi-write security transitions use transactions.
- Passwords use configurable Argon2id with random salts and rehash-on-login.
- CSPRNG tokens are stored only as domain-separated HMAC-SHA-256 digests. IP addresses use a
  separate HMAC key; user agents are sanitized and truncated.
- Login requires a verified primary email and active user. Missing users still incur a dummy Argon2
  verification. Reset requests always return `{ accepted: true }`.
- Sessions enforce absolute/idle expiry, revocation, user state, and `securityVersion`. Password
  reset increments the version and revokes active sessions.
- Raw passwords, bearer tokens, and IP addresses are never persisted.

Production/staging must explicitly supply distinct `AUTH_TOKEN_HASH_KEY` and `AUTH_IP_HASH_KEY`
values of at least 32 characters. See `.env.example`. Secret values redact themselves from JSON and
object inspection.

This package uses Node 24's built-in `node:crypto` Argon2 API. It is experimental in the pinned
runtime, so Node upgrades require the crypto compatibility tests.

HTTP routes, cookies, JWTs, email delivery, distributed rate limiting, queues, MFA, recovery codes,
device management, and OAuth are deliberately deferred.

The HTTP adapter now lives in `apps/api`; it owns opaque cookie transport, public error
normalization, CSRF checks, and the temporary in-process limiter. Raw verification/reset tokens may
cross only into its dispatcher port. The identity package remains unaware of HTTP and cookies.

```sh
pnpm --filter @arena-core/identity test
pnpm lint
pnpm typecheck
```

The Prisma integration gate additionally requires the F1.4 PostgreSQL service.

## Private profile and onboarding

`UserProfileService` owns private current-user profile reads, upserts, partial updates, and derived
onboarding. Display names are trimmed and NFC-normalized; locale is `fa` or `en`; timezones must be
IANA zones; country is optional uppercase two-letter preference metadata, not legal identity.
Onboarding requires an active identity, verified primary email, valid profile, and valid timezone.
Pending users may prepare profiles; suspended users may read but not write; disabled/deleted users
cannot access profiles. Prisma remains behind a use-case-oriented repository. Username, avatar,
public profiles, moderation, search, and game accounts remain outside scope.
