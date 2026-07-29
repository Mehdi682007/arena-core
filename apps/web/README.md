# Web service

The Web app consumes only allowlisted `NEXT_PUBLIC_*` configuration. Next.js source maps and
powered-by headers are disabled. Baseline security headers are enabled and CSP is report-only
until a tested nonce strategy is available. F8.1 adds no frontend feature.

# User Web application

The F9.1 Web is a Persian RTL App Router application with public/authenticated shells, server-side
session protection, a same-origin API proxy, identity flows, dashboard/profile/notification
foundations, settings, and a public FC 26 leaderboard. See `docs/web-architecture.md`,
`docs/design-system.md`, and `docs/user-web-journeys.md`.

No authentication token or secret belongs in a `NEXT_PUBLIC_` variable or browser storage.

F9.3 adds the independent `/admin` support application for permission-aware audit, search,
timelines, safe notification operations and diagnostics. See `docs/admin-web-application.md`.
Backend guards remain authoritative; the UI contains no role editor, account impersonation,
financial mutation or production mock.

# Release candidate

Web `0.1.0-rc.1` is included in the F9.4 route, proxy, privacy, accessibility, and standalone-build
gates.
