# Repository Analysis

## Observed state

Inspection was performed before any project changes.

| Area                 | Observation                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| Root contents        | Empty project workspace except generated `work/` and `outputs/` directories |
| Source code          | None                                                                        |
| Package manifests    | None                                                                        |
| Frameworks           | None detected                                                               |
| Dependency lockfiles | None                                                                        |
| Containers           | None                                                                        |
| Database/migrations  | None                                                                        |
| CI/CD                | None                                                                        |
| Tests                | None                                                                        |
| Git                  | Working directory is not a Git repository                                   |
| Git remotes/history  | None                                                                        |

## Consequences

There is no legacy code, schema, dependency, naming convention, or deployment topology to preserve. There are also no existing quality gates. Bootstrap decisions must be explicit and captured as ADRs.

## Risks and incompatibilities

1. The requested scope is larger than a conventional MVP; enforcing phase gates is essential.
2. Wallet settlement, matchmaking, and match state transitions are concurrency-sensitive.
3. Real-money competition may trigger gaming, gambling, payment, custody, KYC/AML, tax, sanctions, consumer-protection, and age-restriction obligations.
4. Result evidence may contain personal data and needs retention/access rules.
5. A generic rules engine can become unbounded; MVP should use versioned configuration plus typed strategies, not arbitrary executable rules.
6. Redis must not become the source of truth for balances, tickets, or match state.
7. Cross-module Prisma access would erode modular boundaries.
8. Persian-first UI requires RTL, locale, calendar/date, numeral, and timezone testing from the beginning.
9. FC26 naming, imagery, and game data may involve publisher trademark or API restrictions.
10. Tournament implementation competes with the core direct-match acceptance scenario and should be independently gated.

## Discovery completion criteria

- Current repository state recorded.
- Architectural baseline and boundaries selected.
- Initial domain model and ERD prepared.
- Security, financial, legal, operational, and delivery risks documented.
- Work decomposed into independently verifiable tasks.
- No feature implementation started.
