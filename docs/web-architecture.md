# Web application architecture

The Next.js App Router composes public, authentication, and authenticated route groups. UI
primitives live below `src/components`, feature behavior below `src/features`, and transport,
errors, redirect validation, and configuration below `src/lib`. Server components fetch initial
private data with request-specific cookie forwarding and `no-store`; client components perform
mutations through the same-origin backend proxy.

Authentication uses the existing HttpOnly session cookie. The browser never reads the cookie,
stores an auth token, or infers authorization from navigation. The private layout distinguishes
401 from service unavailability: only unauthenticated sessions redirect to login. Return paths
must be local absolute paths.

The backend CSRF contract is Origin allowlisting plus JSON-only write requests. There is no CSRF
token/bootstrap endpoint, so the Web does not invent or persist one. The proxy forwards cookies,
sets the configured Web origin, enforces timeouts, avoids redirects, and returns only required
headers.

Mocks exist only as injected `fetch` functions inside tests. Production modules contain no mock
switch. Public leaderboard data may be cached briefly; session, profile, notifications, ratings,
and preferences are private and never cached.

F9.3 adds a separate `(admin)/admin` route group. Its server layout obtains an allowlisted
capability projection, fails closed when permissions are absent or unavailable, and renders a
permission-aware navigation. Admin feature modules centralize typed API access, safe route
builders, recursive metadata redaction, operational confirmations, tables and timelines. Direct
Backend permission guards remain authoritative.
