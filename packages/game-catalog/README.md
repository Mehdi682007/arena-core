# `@arena-core/game-catalog`

Framework-neutral catalog domain, application services, repository/transaction ports, generic
ruleset validation, and Prisma adapters.

It models games (`DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`), shared platforms and game-platform
availability, non-overlapping game-specific crossplay groups, modes, and immutable-after-publication
versioned rulesets (`DRAFT`, `ACTIVE`, `SUPERSEDED`, `ARCHIVED`). Keys are lower snake case; explicit
slugs are lower kebab case. Records are archived rather than normally deleted.

Ruleset configuration is a bounded `{ schemaVersion, settings }` JSON envelope. It rejects
non-JSON values, cycles, excessive size/depth, non-finite numbers, and prototype-pollution keys.
Unknown generic settings are accepted so future validators can be registered per game.

Public queries return active, visible projections only. API administration requires typed
permissions, session authentication, CSRF protection, and strict DTOs. Migration
`20260725120000_create_game_catalog` owns relational constraints and partial default indexes. With
database persistence disabled, production wiring returns `GAME_CATALOG_UNAVAILABLE`; it never
creates an in-memory runtime catalog.

User game accounts, matchmaking, matches, finance, queues, UI, translations, seeds, and external
game integrations are outside this package.
