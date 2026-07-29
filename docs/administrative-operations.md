# Administrative operations

F7.2 adds backend-only audit, search, timeline and notification support tooling. There is no admin
UI, worker, scheduler or queue.

All routes are under `/api/v1`, require an authenticated session, return `Cache-Control: no-store`,
and are default-deny:

| Method | Route                                           | Permission       |
| ------ | ----------------------------------------------- | ---------------- |
| GET    | `/admin/audit`                                  | `audit.read`     |
| GET    | `/admin/audit/:id`                              | `audit.read`     |
| GET    | `/admin/search`                                 | `support.read`   |
| GET    | `/admin/users/:id/timeline`                     | `timeline.read`  |
| GET    | `/admin/matches/:id/timeline`                   | `timeline.read`  |
| POST   | `/admin/support/notifications/:id/retry`        | `support.manage` |
| POST   | `/admin/support/recovery/:sourceType/:sourceId` | `support.manage` |

Writes retain CSRF/origin and rate-limit enforcement. DTOs reject unknown input. No permission seed
is included.

Audit list filters actor, target, action and dates using an opaque cursor and
`createdAt DESC, id DESC`; offset pagination is unsupported. Metadata is a flat JSON object of at
most 20 primitive fields and 4096 serialized bytes. Secret-bearing keys are rejected.

Search scopes are `USER`, `GAME_ACCOUNT`, `MATCH`, `NOTIFICATION`, `WALLET` and `RATING`.
Filtering may use normalized email/handle, but normalized values are never selected. User and match
timelines merge safe lifecycle projections and sort newest first.

Retry delegates to the existing outbox service; recovery delegates to the existing notification
integration. Neither edits balances, results, disputes, settlement or ratings.

The F9.3 Web interface is documented in `admin-web-application.md`. It exposes only these existing
operations, uses a read-only allowlisted capabilities projection for navigation, and keeps all
direct API permission checks in place. Outbox HTTP responses now explicitly omit recipient,
payload, claim and deduplication internals.
