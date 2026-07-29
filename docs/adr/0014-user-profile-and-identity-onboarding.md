# ADR 0014: Private user profile and derived identity onboarding

- Status: Accepted
- Date: 2026-07-25

## Context

The MVP needs a private current-user profile and clear identity onboarding without public identity,
game resources, or another stored lifecycle flag.

## Decision

Keep Profile inside Identity but separate from authentication services. It owns display name,
`fa`/`en` locale, IANA timezone, optional uppercase two-letter country preference, and derived
onboarding. A use-case-oriented repository hides Prisma. Only current-user `/profile` and
`/onboarding` routes exist. Display name is not unique and there is no username or public profile.

Onboarding is deterministically derived from active status, verified primary email, valid profile,
and valid timezone. Country is optional. The existing schema is sufficient, so no completion field
or migration is added. With DB disabled, protected routes remain registered and return a sanitized
503 after authentication.

## Consequences

Completion cannot drift from authoritative state. Suspended users may read but not write;
disabled/deleted users cannot access profiles; pending users may prepare profiles but cannot
complete onboarding. The API owns session authentication, CSRF, no-store headers, and error mapping.

Avatar/object storage, username, public privacy rules, moderation, search, game accounts, and
additional onboarding require later decisions.

## Alternatives rejected

- Stored onboarding boolean/timestamp: duplicates derived state and can become stale.
- Separate Profile bounded context: unnecessary for current private preferences.
- Public usernames/profiles: require privacy, moderation, and discovery policy.
- Avatar placeholders/object storage: outside identity onboarding.
