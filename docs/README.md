# Phase 0 — Discovery Package

Status: complete  
Date: 2026-07-24  
Scope: documentation and architecture only; no product features are implemented.

## Repository finding

The supplied working directory contains only `work/` and `outputs/`. It has no source files, package manifests, frameworks, Git metadata, branches, commits, or remotes. The proposed stack can therefore be adopted without migration constraints.

## Decision summary

- Architecture: modular monolith in a TypeScript monorepo.
- Runtime applications: Next.js web, NestJS API, BullMQ worker.
- Data: PostgreSQL/Prisma; Redis for queues, locks, and ephemeral coordination.
- Evidence: S3-compatible object storage.
- Money: integer minor units, immutable double-entry ledger, test credits only.
- Integration: domain contracts and application services; no cross-module table writes.
- Localization: Persian-first, English included, RTL/LTR from day one.
- Real-money operations: disabled behind a feature flag until legal and payment reviews.

## Documents

- [Repository analysis](repository-analysis.md)
- [Product requirements](product-requirements.md)
- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Database schema and ERD](database-schema.md)
- [Match lifecycle](match-lifecycle.md)
- [Matchmaking](matchmaking.md)
- [Wallet and ledger](wallet-ledger.md)
- [Result verification](result-verification.md)
- [Dispute resolution](dispute-resolution.md)
- [Security](security.md)
- [API](api.md)
- [Deployment](deployment.md)
- [Production configuration](production-configuration.md)
- [Production security](production-security.md)
- [Observability](observability.md)
- [Administrative Web application](admin-web-application.md)
- [Deployment readiness](deployment-readiness.md)
- [Dependency security](dependency-security.md)
- [Roadmap](roadmap.md)
- [Assumptions](assumptions.md)
- [Open questions](open-questions.md)
- [Legal and compliance risks](legal-and-compliance-risks.md)
- [ADR index](adr/README.md)
- [Launch readiness](launch-readiness.md)
- [F10 server handoff](server-handoff.md)
- [Production environment checklist](production-environment-checklist.md)
- [Manual acceptance tests](manual-acceptance-tests.md)
- [Release candidate checklist](release-candidate-checklist.md)

## Phase 1 entry gate

Before implementation, the product owner should decide the launch jurisdiction, minimum user age, initial test-credit currency label, account verification channel, and whether tournaments remain in the first public MVP. Reversible technical defaults are recorded in `assumptions.md`.

The first Phase 1 task is `F1.1 — initialize the pnpm/Turborepo workspace and quality gates`, defined in `roadmap.md`.
