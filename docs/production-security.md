# Production security

The API emits `nosniff`, frame denial, strict-origin referrer policy, a restricted permissions
policy, COOP/CORP, and an API CSP of `default-src 'none'; frame-ancestors 'none'; base-uri 'none';
form-action 'none'`. HSTS is enabled only in staging/production; subdomains are opt-in and preload
is not enabled. Express identity headers are removed. Web uses the same baseline plus a CSP
report-only foundation so Next.js inline runtime behavior is not broken.

CORS is exact origin matching: wildcard, `null`, malformed origins, scheme/port mismatch, and
subdomain confusion are rejected. Origin-less server requests are a separate configurable policy.
Proxy trust is never implicit `true`.

JSON body size, header/request/keep-alive timeouts, session cookie attributes, and route rate
limits are bounded. Production cannot disable rate limiting. Logs do not contain bodies, auth
headers, cookies, credentials, or production stack traces.

No Redis, queue, external observability SDK, runtime config mutation, automatic migration, or
production deployment is introduced by F8.1.
