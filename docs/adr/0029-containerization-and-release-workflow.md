# ADR-0029: Containerization and release workflow

Status: Accepted

## Context

Arena Core needs reproducible deployment artifacts without coupling application startup to schema
or catalog changes, and without embedding a particular registry or server.

## Decision

Use one multi-stage Dockerfile with distinct API, Worker, Web, migrate, and seed targets. Pin Node
and pnpm versions, install with the frozen lockfile, run with UID/GID 10001, and use Next.js
standalone output. Migration is a mandatory independent one-shot job. FC 26 seed is an optional
manual profile and never an application dependency.

Use production and staging Compose foundations with read-only filesystems and Linux hardening.
Identify releases with immutable version-plus-SHA tags and a checksummed manifest. CI performs
quality verification and image builds only; registry authentication, image push, and deployment
remain outside this repository.

## Consequences

Application images cannot silently mutate the database. Rollout ordering and rollback decisions
are explicit. Docker, PostgreSQL, vulnerability scans, and restore drills still require an
external runtime; static validation cannot substitute for them.
