# ADR-0008: Local development infrastructure

- Status: Accepted
- Date: 2026-07-25

## Context

Future persistence, coordination, evidence storage, and email work needs a reproducible local foundation before application integrations or executable schemas are introduced.

## Decision

Use one Compose v2 project containing pinned PostgreSQL, Redis, MinIO, a one-shot MinIO client initializer, and Mailpit images. PostgreSQL, Redis, and MinIO persist through project-scoped named volumes. Mailpit remains ephemeral. Each long-lived service has a native or product HTTP healthcheck; infrastructure health requires `healthy`, not merely `running`.

PostgreSQL and MinIO receive clearly marked development-only credentials through Compose interpolation. Ports bind to loopback by default. `minio-init` waits for healthy MinIO, idempotently creates the evidence bucket, disables anonymous access, verifies the bucket, and exits successfully.

Infrastructure variables remain Compose-only (configuration option A). No application parses them and no database, Redis, queue, object-storage, or mail client is introduced in F1.4. This preserves the established application contract until an integration phase has an actual consumer.

Root scripts use `docker compose` with an explicit file path. Normal shutdown preserves volumes; the explicitly named reset command deletes them.

## Consequences

Developers receive repeatable local services and real health signaling without host-specific bind mounts. Data survives ordinary teardown. Local credentials, loopback exposure, Mailpit, and the topology itself are unsuitable for production. Image updates require validation and documentation.

## Alternatives rejected

- Installing application clients now would create unused configuration and cross the task boundary.
- Host installations are less reproducible and differ across operating systems.
- Anonymous MinIO or trust-authenticated PostgreSQL would weaken even the development baseline.
- Bind-mounted data directories introduce Windows/macOS/Linux permission and filesystem differences.
- Floating image tags make environments non-repeatable.
