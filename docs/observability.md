# Observability

API and Worker startup records are JSON-compatible structured events. The base fields are
timestamp, level, message, service, environment, and optional request/correlation, route, method,
status, duration, and error code. Request bodies, raw URLs, Authorization, Cookie, credentials,
tokens, email addresses, and full IPs are not access-log fields.

`X-Request-ID` and `X-Correlation-ID` accept only 8–128 bounded opaque characters. Invalid values
are replaced. AsyncLocalStorage isolates context across concurrent requests. Error responses carry
the request ID without a production stack.

Redaction is recursive, case-insensitive, circular-safe, depth-bounded, BigInt-safe, and masks
credentials in PostgreSQL URLs and sensitive query parameters without mutating input.

The metrics port supports counters and durations with low-cardinality labels. The in-memory
adapter is for tests; production currently uses the no-op abstraction. No exporter or external
monitoring provider is configured.

`GET /api/v1/health` is liveness. `GET /api/v1/health/ready` checks configured dependencies and
becomes not-ready during shutdown. `GET /api/v1/admin/diagnostics` requires `diagnostics.read` and
returns only version, environment, build metadata, uptime, dependency states, migration mode,
shutdown state, and a non-sensitive configuration fingerprint.

# Administrative diagnostics presentation

The F9.3 diagnostics page manually reads the existing permission-protected projection. It displays
only service/version/environment, build SHA, uptime, bounded dependency states, migration mode,
shutdown state and configuration fingerprint. It is not a log viewer and exposes no environment
dump, filesystem path, process arguments or connection string.
