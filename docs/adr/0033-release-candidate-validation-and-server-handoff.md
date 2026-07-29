# ADR-0033: Release candidate validation and server handoff

## Context

F1–F9.3 provide the first complete product surface, but infrastructure runtime is unavailable and
the repository has no initial commit. F9.4 must detect integration drift and produce a reviewable
RC without deploying or adding product behavior.

## Decision

Use `0.1.0-rc.1` as a non-final identity and `uncommitted` as build SHA until a real HEAD exists.
Preserve one immutable manifest with dependency and migration hashes. Add a root product-integration
gate that maps golden journeys to real domain/application/HTTP tests and verifies cross-surface
route, privacy, idempotency, and artifact contracts.

Release go/no-go requires zero BLOCKER and HIGH findings plus all locally executable root gates.
Docker, PostgreSQL, SMTP, restore, vulnerability scan, TLS, and live smoke remain explicit F10
runtime prerequisites. Test adapters may replace unavailable infrastructure, never business flows
or production data.

The RC adds no feature, permission, payment, impersonation, deployment, or new runtime dependency.
Server handoff is documented separately and does not authorize production rollout.

## Consequences

The release decision is repeatable and cache-independent, while limitations stay visible. A future
committed release must regenerate the manifest with the real immutable SHA and rerun all gates.
Provisioning cannot claim launch readiness until runtime prerequisites pass.

## Alternatives rejected

- Calling existing package tests an E2E result without an integration map hides route drift.
- Adding a heavy browser framework before infrastructure exists increases supply-chain scope.
- Treating mocks as live PostgreSQL, SMTP, or Docker evidence is misleading.
- Deploying directly from an uncommitted workspace is not an acceptable release process.
