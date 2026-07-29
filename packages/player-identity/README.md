# Player Identity

`@arena-core/player-identity` owns private user game-account claims, platform handles, manual
verification, primary-account selection, lifecycle, and append-only review history. Domain and
application code are framework-neutral; only the Prisma adapter imports database types.

Handles are temporarily normalized with trim, Unicode NFC, preserved display case, Unicode
lowercase uniqueness, 2–64 graphemes, and rejection of control/bidi/invisible formatting. All
seven FC 26 platform keys currently use this generic policy. Changing normalization requires a
versioned migration/conflict review.

Active claims are `PENDING`, `VERIFIED`, or `SUSPENDED`; only one is allowed per user/platform and
per platform/normalized handle. Historical `REJECTED` and `DISCONNECTED` rows remain. Only
`VERIFIED` accounts can be primary, with at most one per user/game.
`verifiedAt` and `lastVerifiedAt` record the most recent successful manual verification in F3.3.

F3.3 supports only `UNVERIFIED` and admin `MANUAL` verification. Review notes are private. No
OAuth, provider API, external credential, evidence, public profile, seed, or runtime in-memory
persistence exists. With database disabled, the API returns `PLAYER_IDENTITY_UNAVAILABLE`.
