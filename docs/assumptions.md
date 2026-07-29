# Assumptions

- F7.2 permissions are provisioned by a later controlled process; none are seeded.
- Administrative timelines are investigation projections, not authoritative event stores.

## F5.2

- `ARENA_POINT` is the only asset and amount comes from the immutable Match snapshot.
- Existing FC26 rulesets have no non-zero entry requirement and remain unchanged.
- Reservation precedes Ready; Match start requires both entries satisfied.
- Release does not move ledger value; automatic refund is pre-start only.
- Final distribution is not implemented.

## F4.3

- Either participant may start a fully-ready match.
- MVP results contain two side-based scores.
- Matching submissions auto-confirm; differing submissions conflict.
- Draw policy comes from the captured ruleset snapshot.
- Timeout never produces an automatic winner.
- Evidence, Wallet and Rating effects do not exist yet.

## Game catalog

- FC 26 is only a future first configuration, never a hard-coded domain rule.
- Platforms are shared catalog records connected through `GamePlatform`.
- Rulesets are versioned and active versions are immutable.
- The public catalog requires both `ACTIVE` and `isVisible=true`.
- Crossplay uses game-specific, non-overlapping groups.
- Names and descriptions are current source text; localization is future work.

These defaults are reversible and must be validated before public launch.

- The pinned Node 24 runtime provides experimental `node:crypto.argon2`; runtime upgrades must pass
  compatibility tests.
- Email identity is NFC-normalized, trimmed, and case-insensitive; provider-specific dot removal and
  plus-tag stripping are not performed.
- Reset is available to verified primary emails for active or suspended users; login is active-only.
- F2.2 account lockout is authoritative until distributed edge throttling is added.
- Browser authentication uses opaque database sessions in an HttpOnly SameSite=Lax cookie, not JWT.
- Secure cookies and explicit Origin allowlists are mandatory in staging/production.
- Email delivery is pending; runtime message dispatch fails closed and test capture is injection-only.
- The in-process rate limiter is temporary and cannot coordinate multiple API instances.

1. The repository is genuinely new; no unprovided legacy system must be integrated.
2. pnpm workspaces plus Turborepo are acceptable for the TypeScript monorepo.
3. Node.js active LTS is selected and pinned during Phase 1.
4. PostgreSQL is the sole transactional source of truth.
5. Persian is default; English is complete at MVP launch.
6. Email verification is implemented first; SMS is abstracted but not activated.
7. Access/refresh-token authentication uses secure HttpOnly cookies for the browser and CSRF defenses.
8. MVP currency is a non-redeemable test-credit unit with integer minor units.
9. One test currency is operational; schema includes currency code for future isolation.
10. Individual 1v1 competition is the first supported participant model.
11. FC26 configuration is seed data and may use placeholder-owned artwork until licensing is confirmed.
12. Evidence consists of screenshots only and is private by default.
13. Simple Elo is calculated after terminal settlement.
14. Trust score is event-derived, explainable, and not a legal identity score.
15. Single-elimination tournaments are feature-flagged independently.
16. Production infrastructure provider and launch jurisdiction are undecided.
17. Terms, privacy policy, and competition rules remain clearly labeled legal drafts.
18. F1.4 Docker runtime remains unverified by explicit product-owner decision.
19. Email is the first MVP login identity unless superseded later.
20. A user may own multiple emails, with at most one primary email.
21. Sessions will be server-side, expiring, revocable, and stored by token hash.
22. Phone identity remains outside the current scope.
23. Display names are private non-unique labels; no username exists yet.
24. Country is optional preference metadata, not legal identity or residence.
25. Identity onboarding covers verified email and profile completeness only.
26. Profiles are private to the current authenticated user.
27. A user has at most one active claim per GamePlatform but may have accounts across platforms.
28. Verification is manual in F3.3 and only verified accounts may be primary.
29. Catalog default platform and user primary account are independent.
30. Handle normalization is generic, Unicode-aware, and temporary pending provider rules.

# F4.1 assumptions

- One active matchmaking request per user is the MVP policy.
- Request TTL is 900 seconds, proposal TTL is 30 seconds, and each evaluation is bounded to 50
  candidates unless server-side configuration changes in a later phase.
- Language and region are preferences, not identity, legal-country, latency, or skill signals.
- An accepted proposal is durable intent for F4.2; it is not itself a match.
- PostgreSQL runtime integration remains unavailable, so transaction/constraint runtime behavior
  is not claimed from static or mock tests.

# F4.2 assumptions

- A match is created only from an accepted proposal and each proposal has at most one match.
- MVP matches have exactly two participant sides; 2v2 team membership is deferred.
- Opponent display handle/platform become visible only after match creation.
- Ready TTL defaults to 120 seconds and is server-only.
- User cancellation is allowed before `READY`, never after.
- Ruleset and participant snapshots are immutable; `SUPERSEDED` rulesets remain valid sources for
  already accepted proposals, while `ARCHIVED` does not.
- No match result exists in F4.2.

# F4.4 assumptions

- Evidence is declaration metadata only; no file is stored.
- A match has at most one active dispute.
- Opponent response is optional but deadline-bound.
- Expiration does not automatically resolve, award a win, or mutate a result.
- Admin resolution is permission-protected and audited.
- Corrected or voided results preserve append-only revision history.
- No wallet, settlement, rating, or notification effect exists.
- ARENA_POINT is non-monetary, nonwithdrawable, and has no cash value or conversion.
- Each user has at most one lazy Wallet and one available account per asset.
- A user available balance cannot become negative.
- Only authorized administrators may issue or adjust points.
- Posted entries are immutable; correction requires a linked reversal.
- F5.3 supports exactly two participants and one immutable settlement per match.
- The default settlement delay is 86400 seconds; no scheduler is implied.
- Terminal admin-resolved disputes may settle from their resolution timestamp.
- Elo v1 is sufficient for the first rating foundation and uses integer persistence.
- Crossplay-compatible platforms share a User/Game/GameMode/CrossplayGroup rating.
- Normal confirmed results wait 86400 seconds; terminal admin-resolved disputes may rate immediately.
- Reconciliation only reports drift and recovery is manually invoked in bounded batches.
- F7.1 notification delivery is invoked explicitly; a background polling worker and distributed
  queue are intentionally absent.
- Notification PostgreSQL runtime verification remains blocked when PostgreSQL is unavailable;
  static migration verification and test adapters are not represented as real persistence.

# F8.1 assumptions

TLS termination and the exact trusted proxy hop count are deployment-owned. Migrations run as an
external release step. Web CSP remains report-only until nonce integration is tested.

# F9.3 assumptions

- Existing Backend permission assignments are authoritative; the Web does not infer roles.
- Full email, raw provider responses and delivery claim data are unnecessary for support UI.
- Manual diagnostics refresh is sufficient; realtime monitoring remains outside scope.

# F9.4 release-candidate assumptions

The first integrated candidate is `0.1.0-rc.1`; while no Git HEAD exists, its explicit build
identity is `uncommitted`. Docker, PostgreSQL, SMTP, TLS, backup/restore, vulnerability scanning,
and live smoke checks are F10 prerequisites and are not inferred from test adapters.
