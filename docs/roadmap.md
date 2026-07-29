# Execution Roadmap

Each task should be a small reviewable change. Every phase ends with format, lint, strict type-check, tests, migration validation, builds, and a written result.

## Phase 1 — Foundation

- **F1.1** Initialize pnpm workspace/Turborepo, pin runtime/package manager, add shared strict TypeScript and formatting/lint configs.
- **F1.2** Scaffold `web`, `api`, and `worker` with health-only behavior.
- **F1.3** Add typed environment validation and `.env.example`.
- **F1.4** Add PostgreSQL, Redis, MinIO, and mail test service to Compose.
- **F1.5** Initialize Prisma with migration/seed commands but no feature UI.
- **F1.6** Add structured logging, request/correlation IDs, error envelope, health/readiness.
- **F1.7** Add CI quality gates and contributor/setup documentation.
- **Exit:** clean install, Compose infrastructure, migrations, tests, and all three builds pass.

## Phase 2 — Identity and Access

- User/profile/session schema; password and verification flows; rotating sessions; password reset.
- Roles, permissions, guards, object-level policies, security/rate-limit tests.
- **Exit:** register, verify, login, refresh, revoke, reset, and permission-denial integration tests pass.

## Phase 3 — Game Configuration

- Game/platform/mode/account models and admin CRUD.
- Crossplay policy and immutable rule-set versions.
- FC26 seed for PC/PS5/Xbox Series, 1v1, dual submissions, screenshots.
- **Exit:** an admin configures a game without code changes; incompatible accounts are rejected.

## Phase 4 — Wallet Foundation

- Accounts, transactions, entries, projections, admin test-credit command.
- Lock/release/refund APIs, idempotency, concurrency and reconciliation tests.
- **Exit:** balanced ledger and replay/parallel-call tests prove no duplicate or negative posting.

## Phase 5 — Matchmaking

- Preferences/tickets, compatibility query, worker, acceptance deadline, cancellation/requeue.
- Database ownership/version constraints and duplicate-worker tests.
- **Exit:** compatible users match once; incompatible users never match.

## Phase 6 — Match Lifecycle

- Match/participant/state-transition model and guarded transition service.
- Atomic entry lock, timeouts, history projection.
- **Exit:** valid transitions succeed; stale/invalid/concurrent transitions are no-ops or stable errors.

## Phase 7 — Results and Evidence

- Signed upload flow, metadata/authorization, result revisions, comparison strategy.
- Agreement and review-state tests.
- **Exit:** matching submissions verify; private evidence access and conflicting submissions behave correctly.

## Phase 8 — Disputes and Settlement

- Dispute actions/reviewer UI API, resolution, refund, prize/commission settlement, audits.
- **Exit:** both winner and refund paths balance; retries cannot settle twice.

## Phase 9 — Rating and Reputation

- Elo policy, history, reputation event taxonomy, trust projection.
- **Exit:** only terminal eligible matches update ratings exactly once.

## Phase 10 — Tournament MVP

- Flagged single-elimination registration, capacities, seeding, bracket rounds, advancement/champion.
- **Exit:** deterministic 4/8/16-player bracket scenarios pass.

## Phase 11 — Frontend Completion

- Persian/English public pages; auth/profile/game accounts; matchmaking; match room; wallet/history.
- Admin catalog, matches, evidence/disputes, wallets/ledger, audit, flags/settings.
- Responsive, RTL/LTR, accessibility, loading/empty/error/success states.
- **Exit:** acceptance journey works at target mobile and desktop viewports.

## Phase 12 — Hardening

- Threat/security review, performance/load tests, E2E acceptance suite, backup/restore drill.
- Deployment/runbooks, staging readiness, privacy/retention controls, legal launch gates.
- **Exit:** acceptance scenario, operational checks, and release checklist pass with real money still disabled.

## First implementation task

**F1.1 — Workspace initialization**

Creates only root workspace manifests, lockfile, runtime pin, shared strict TypeScript config, ESLint/formatter config, ignore rules, and baseline scripts. It does not scaffold product features. Completion requires reproducible install plus passing format, lint, and type-check commands.
