# ADR-0032: Administrative Web application

- Status: Accepted
- Date: 2026-07-28

## Context

F7.2 provides append-only audit, bounded search, safe timelines, support notification operations
and diagnostics. F9.3 must expose those capabilities without creating a second authorization
model or a generic privileged console.

## Decision

Use an independent `/admin` App Router boundary. A minimal read-only capability projection returns
only allowlisted existing permission keys for navigation; direct Backend guards remain default
deny. Every private read is server-side and `no-store`.

Audit remains immutable. Search and timelines consume existing safe projections and all metadata
is passed through a bounded defense-in-depth redactor. Notification HTTP responses use an explicit
safe projection that excludes delivery internals. Retry and recovery are server-confirmed,
CSRF-protected writes with confirmation and no automatic retry.

Diagnostics is manually refreshed and limited to operational status fields. The UI provides no
impersonation, role management, wallet/result mutation, dispute administration, raw log access,
export, realtime channel or production mock.

The interface is Persian RTL, responsive, keyboard accessible, and uses semantic tables, lists,
labels, focus states and status announcements.

## Consequences

Operators receive a narrow support interface aligned with existing Backend capabilities.
Permission changes take effect on subsequent server renders and Backend checks. A capabilities
read adds no administrative authority but avoids hard-coded role names and stale client grants.
Without a live Backend, the UI reports unavailable rather than synthesizing data.

## Alternatives rejected

- Hard-coded role names: duplicate and weaken the permission model.
- A client-side permission cache: risks stale grants and sensitive persistence.
- A generic JSON/log viewer: expands disclosure and injection risk.
- Optimistic operational mutations: can misrepresent delivery or recovery state.
- A dashboard framework or data grid dependency: unnecessary bundle and maintenance cost.
