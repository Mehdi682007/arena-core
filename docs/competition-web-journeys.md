# Competition Web journeys

Authenticated users select active catalog data and a verified game identity, then create one
server-validated matchmaking request. Status refresh is manual; no polling, WebSocket, SSE, queue
position, or estimated wait is invented. Proposals expose only acceptance state and server expiry.

The match room renders the safe MatchView: display handles, platforms, readiness, rules snapshot,
deadlines, and lifecycle. Ready and start are explicit JSON writes. Entry reservation and
settlement views show only the current user's non-monetary ARENA_POINT amount and never ledger,
wallet, escrow, fingerprint, or opponent finance data.

Result submission sends the existing SCORE schema with SIDE_A/SIDE_B and bounded integer scores.
Evidence is declaration metadata only; there is no upload or arbitrary URL. Disputes use existing
reason/outcome enums, bounded text, and owned evidence references. Admin notes, reviewer identity,
raw opponent evidence, and internal calculation snapshots are not rendered.

Notification deep links are allowlisted by type and require a UUID matchId. Private requests are
no-store and all writes retain the F9.1 same-origin JSON/Origin CSRF boundary.
