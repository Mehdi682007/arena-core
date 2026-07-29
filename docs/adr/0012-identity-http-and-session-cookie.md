# ADR 0012: Identity HTTP and opaque session cookie

- Status: Accepted
- Date: 2026-07-25

## Context

F2.2 provided transport-neutral identity services. Browser-facing authentication now needs a
versioned HTTP boundary without introducing JWTs, email infrastructure, or a database substitute.

## Decision

Expose ten REST operations below `/api/v1/auth`. Use strict Zod DTOs and centralized safe error
mapping. Authentication uses only an opaque, HttpOnly database-session cookie named
`arena_session`; token material is never returned in JSON. JWT was rejected because immediate
revocation and security-version checks are already database-backed requirements.

A global guard is default-protected. A collision-safe `@Public()` marker is limited to health,
register/login, verification, and reset. The guard places only `{userId, sessionId}` on the request.

Cookie defaults are `HttpOnly`, `SameSite=Lax`, `Path=/`; Secure is mandatory in staging/production.
Unsafe methods require JSON and, in strict environments, an exact allowed Origin. This Origin +
SameSite policy is the MVP CSRF control; CORS remains separate.

An in-process, bounded IP/endpoint limiter protects sensitive routes and returns `429` with
`Retry-After`. It is explicitly not distributed. Direct request IP is used only in development/test;
production proxy IP is ignored until a restricted trusted-proxy policy exists.

Raw verification/reset tokens cross only the message-dispatcher port. The runtime dispatcher fails
closed because no provider exists. A post-commit delivery failure does not roll back registration.

When the database is disabled, the module remains wired and returns a redacted 503 for persistence
operations. Test service/dispatcher adapters are injection-only and are not runtime fallbacks.

## Consequences

Session theft remains bearer-token theft, mitigated by HttpOnly/Secure/SameSite, short validation
paths, expiry, revocation, and no-store responses. Horizontal deployment requires a distributed
limiter. Production origins, cookie domain, trusted proxy, email delivery, session UI, and OpenAPI
remain explicit follow-up decisions.
