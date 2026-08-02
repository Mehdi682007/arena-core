# Administrative Web application

The F9.3 administrative experience is a separate Persian RTL route boundary under `/admin`. It
uses the existing opaque session cookie and a read-only `/admin/capabilities` projection. Unknown
permissions are denied and hidden; every direct API request remains protected by the Backend
permission guard.

## Permission and route matrix

| Capability             | Routes                                                     |
| ---------------------- | ---------------------------------------------------------- |
| `audit.read`           | `/admin/audit`, `/admin/audit/:id`                         |
| `support.read`         | `/admin/search`                                            |
| `timeline.read`        | `/admin/users/:id/timeline`, `/admin/matches/:id/timeline` |
| `notifications.read`   | notification overview, Outbox, detail and dead-letter      |
| `notifications.retry`  | retry eligible Outbox messages                             |
| `notifications.manage` | claim and source recovery                                  |
| `support.manage`       | support operations exposed by F7.2                         |
| `diagnostics.read`     | `/admin/diagnostics`                                       |

The dashboard shows only links supported by the current session projection. This is presentation,
not authorization: Backend guards remain the source of truth and permission failures fail closed.
The additional catalog, account, match, dispute, matchmaking, wallet, finance, settlement and Rating
routes are initial permission-aware operational views over sanitized existing APIs. Wallet and finance
views currently provide navigation/instructions; they are not a complete business administration UI
and intentionally provide no high-risk financial mutation workflow.

The administrator bootstrap reactivates an existing expired system-role assignment by clearing only
`expiresAt`; it intentionally preserves the original `assignedAt` and `assignedByUserId` provenance
and appends a fresh audit event. Suspended, disabled, deleted and ambiguous users remain ineligible,
and audit metadata contains neither the submitted email nor credentials.

## Operational experiences

Audit uses Backend ordering and opaque cursor pagination. Detail is immutable and metadata passes
through an additional recursive, bounded sensitive-key redactor. Search is explicit-submit and
supports only the six Backend scopes. User and match timelines render semantic ordered lists from
safe summaries; no raw payload is reconstructed.

Notification views use a dedicated HTTP safe projection. Claim tokens, deduplication keys,
recipient identifiers, payload snapshots, provider responses and raw exceptions are excluded.
Retry and recovery require confirmation, use the existing same-origin JSON proxy, do not update
optimistically, and refresh only after server confirmation.

Diagnostics is manually refreshed and displays only version, environment, build SHA, uptime,
bounded dependency states, migration mode, shutdown state and the server-generated configuration
fingerprint. It never displays environment variables, paths, arguments or connection strings.

## Security and privacy

All server reads are `no-store`. Browser writes carry the HttpOnly session cookie through the
same-origin proxy and are protected by the existing Origin plus JSON-only CSRF policy. The Web
stores no permission, audit, diagnostic, search, token or session data in browser storage.
Identifiers are encoded before navigation and links come from a local route registry.

The Admin Web has no impersonation, permission editor, user deletion, balance/ledger mutation,
result override, dispute resolution, bulk action, export, upload, payment, realtime transport or
production mock. Backend errors are normalized and raw provider failures are not rendered.

Tables include captions and scoped headers. Forms have labels, mutations use native accessible
confirmation dialogs and live status regions, focus indicators are visible, and the layout adapts
from a desktop sidebar to a horizontally scrollable tablet/mobile navigation while preserving RTL
order.
