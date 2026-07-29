# ADR-0028: Production security, configuration, and observability

## Status

Accepted.

## Context and decision

Arena Core needs deterministic production safety before deployment. `APP_ENV` is now the explicit
environment contract and is validated against `NODE_ENV`. Staging and production fail fast on
unsafe secrets, URLs, cookies, CORS, proxy, rate-limit, error exposure, database, and migration
settings.

The platform uses Node/Nest primitives: AsyncLocalStorage request context, JSON-compatible
structured logs, recursive redaction, a central fallback error filter, health/readiness with
shutdown state, graceful signal handling, and a provider-neutral metrics port. CORS is exact-match,
proxy trust is explicit, and API security headers/CSP are enforced globally. Diagnostics are
admin-only and expose a non-sensitive fingerprint.

No external observability provider, Redis, queue, runtime database table, automatic migration, or
new dependency is adopted.

## Consequences

Production configuration errors stop startup and report variable names only. Operations gain safe
correlation and diagnostics but must choose exporters and deployment tooling later. Web CSP remains
report-only until a nonce strategy is tested. PostgreSQL readiness still requires a real runtime.

## Alternatives rejected

Implicit `NODE_ENV`, wildcard CORS, `trust proxy=true`, request-body logging, framework defaults,
automatic migrations, and immediate adoption of external exporters were rejected because they
weaken control or expand deployment scope.
