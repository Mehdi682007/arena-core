# Configuration package

This package is the only bootstrap environment parser. `APP_ENV` is `local`, `test`, `staging`, or
`production` and must match framework `NODE_ENV`. Values are trimmed; empty values are missing;
booleans are strict; numbers bounded; origins and URLs normalized; and returned objects frozen.

Staging/production enforce secrets, HTTPS URLs, database/SMTP consistency, secure cookies, exact
CORS, explicit proxies, rate limiting, external migrations, timeouts, and hidden errors. Failures
name variables but never values. See `docs/production-configuration.md`.
