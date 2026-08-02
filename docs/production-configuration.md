# Production configuration

`APP_ENV` is the application source of truth: `local`, `test`, `staging`, or `production`.
`NODE_ENV` remains a framework switch and must map respectively to `development`, `test`,
`production`, and `production`. A mismatch fails before the server starts.

Production requires HTTPS `APP_BASE_URL`, `API_BASE_URL`, and `WEB_BASE_URL`; independent
32-character-or-longer `SESSION_SECRET` and `CSRF_SECRET`; an enabled PostgreSQL configuration
unless explicit maintenance mode is active; secure cookies; an exact CORS allowlist; an explicit
proxy mode; rate limiting; `LOG_LEVEL`; and external migration mode. Placeholder secrets,
localhost/public HTTP URLs, wildcard origins, automatic migrations, debug routes, and exposed
errors are rejected.

Production also requires an exact HTTPS `ADMIN_ORIGIN` and matching `ADMIN_DOMAIN`. The admin
origin must differ from `APP_BASE_URL`; credentials, paths, queries, fragments, wildcard hosts,
and arbitrary sibling subdomains are rejected. Both exact origins are included only in the
authentication/CSRF allowlists that need them. Cookies remain host-only.

SMTP variables are conditional. When SMTP is disabled, delivery remains explicitly unavailable.
When enabled, host, port, credentials, sender, and bounded timeouts are validated by the existing
email contract. Secrets are never returned by diagnostics or configuration errors.

`TRUST_PROXY_MODE` is `none`, `loopback`, `private`, or `hop-count`; the last requires one to ten
trusted hops. `none` ignores forwarding headers for Express IP derivation. The recommended cookie
is `__Host-arena_session`, which requires `Secure`, `Path=/`, and no Domain.

Migrations are an external release responsibility. Runtime startup never runs `db push`, migrate,
or seed. `.env.production.example` is intentionally non-deployable until every REQUIRED
placeholder is replaced.
