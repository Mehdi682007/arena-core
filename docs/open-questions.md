# Open Questions

- Which controlled provisioning process will grant the four F7.2 permissions in each environment?
- Should future timeline expansion use materialized projections once measured query volume
  justifies it? F7.2 intentionally uses bounded read-time aggregation.

## Match Finance follow-ups

- Future ruleset entry-amount configuration and versioning.
- Winner, draw, post-start void, and dispute distribution.
- Possible future platform share and multiple assets.
- Wallet suspension during Match.
- Recovery automation and notifications.

## F4.3 follow-ups

- Evidence requirements and moderator access
- Result edit window and no-show/one-sided-result policy
- Full dispute and arbitration workflow
- Rating and Wallet settlement
- Game-specific schemas and team/2v2 confirmation authority

## Game catalog

- Which translation storage strategy should catalog metadata use?
- Should a changed slug retain a redirect history?
- Will future crossplay semantics require overlapping groups?
- How are game-specific ruleset validators registered and versioned?
- Does ruleset publication eventually require approval?
- What catalog audit-log granularity is required?
- How should shared platform retirement affect active games?
- Should metadata imports from external sources ever be supported?
- Where will cover images be owned?
- Are region-specific platform variants separate catalog records?

- Which versioned HMAC key-rotation strategy should be adopted?
- Should suspended users remain eligible for password reset?
- Which email delivery/retry/audit contract will send identity tokens?
- Which edge rate-limit dimensions should complement account lockout?
- When should MFA, recovery codes, trusted devices, and OAuth enter scope?
- What are the final production frontend origins and cookie domain?
- When should Origin-only CSRF evolve to a per-session token?
- Which distributed rate limiter and trusted-proxy policy will production use?
- When should OpenAPI generation and a session-management UI be introduced?

## Blocking before public launch

1. Which countries/jurisdictions will be served and excluded?
2. What is the minimum age, and how is age/identity verified?
3. Does any test credit have purchase, redemption, transfer, or prize value?
4. Which publisher permissions are required for game names, imagery, competition operation, and APIs?
5. What evidence retention/deletion period applies?
6. Who may review disputes, and what appeal/escalation policy is required?
7. Which privacy, consumer, tax, sanctions, KYC/AML, and skill-gaming regimes apply?

## Product decisions

8. Is email-only verification sufficient for MVP?
9. Which countries, timezones, and regional matchmaking buckets launch first?
10. Exact FC26 rule set: duration, draw handling, disconnect/no-show/forfeit rules, fee bounds, and deadlines?
11. Rating constants, provisional period, inactivity handling, and season resets?
12. Trust-score inputs, user-visible explanations, and recovery rules?
13. Are tournaments required for the first beta or a post-core milestone?
14. What notification channels are required beyond in-app/email?

## Technical decisions

15. Hosting provider, object store, email provider, observability provider, and secret manager?
16. UUIDv7 versus ULID identifiers?
17. Cookie-based browser auth only, or support bearer tokens for future native clients now?
18. Maximum screenshot count, formats, size, and malware scanning provider?
19. Required recovery time/recovery point objectives and data retention?
20. Will users have a public username, and what normalization/reservation policy applies?
21. When, if ever, is phone authentication introduced?
22. Which password algorithm and production-calibrated parameters are required?
23. What are session idle and absolute durations across browser/native clients?
24. What retention and erasure schedule follows account soft deletion?
25. How are keyed IP-hash secrets rotated without losing abuse-correlation value?
26. Can a future non-email identity become primary, and how is that represented?
27. What username allocation and change policy will apply?
28. How will avatars, public-profile privacy, and user discovery work?
29. What display-name moderation and spoofing controls are required?
30. Which additional profile locales or onboarding steps are needed?
31. Will date of birth, phone, or game-account onboarding ever be required?
32. Is EA identity separate from platform identity, and how are accounts transferred?
33. Which official Steam/PSN/Xbox/Nintendo handle and linking rules apply?
34. What ownership/evidence workflow and reverification interval should replace manual review?
35. Will multiple active accounts per platform or public game profiles ever be allowed?
36. What privacy and retention policy applies to disconnected handles and review notes?

# F4.1 deferred questions

- How should F4.2 atomically consume an accepted proposal into a Match while remaining idempotent?
- Which later scheduler/transport should reevaluate searching requests and expire records?
- When real latency and rating signals exist, how will compatibility policy be versioned?
- Should future product policy allow more than one active queue per user?
- Which PostgreSQL test environment will verify the F4.1 trigger, partial indexes, and transaction
  races?

# F4.2 deferred questions

- How do lobby/start and `IN_PROGRESS` transitions work?
- What penalties apply to ready timeout, cancellation, or disconnect?
- Is rescheduling permitted and when should an opponent handle be revealed?
- How are teams and four participants represented for 2v2?
- What protocol handles result submission, participant confirmation, evidence, and disputes?

# After F4.4

Open decisions include object-storage provider, presigned uploads, file retention, antivirus,
encryption, screenshot/video limits, reviewer SLAs, appeals, multi-reviewer arbitration, fraud
detection, post-resolution wallet/rating settlement, and user notifications.

## Deferred beyond F5.1

Real-money assets, providers, deposits, withdrawals, escrow, match entry reservations,
prize settlement, refunds, compliance, multiple assets, ledger partitioning, and
high-volume reconciliation are intentionally unresolved.

- Which operational component will invoke eligible settlement recovery later?
- Should a later phase add an audited correction transaction for exceptional recovery?
- Should platform-filtered leaderboards be added only after rating gains an authoritative platform
  dimension, or be derived from verified-account history?
- What future Season model should partition ratings without rewriting Elo v1 history?
- Which operational component will invoke bounded rating recovery when scheduling is introduced?
- Should a future phase implement audited rating reversal/rebuild after exceptional finality repair?
- Which queue/broker and operational ownership model should be selected if asynchronous
  notification delivery is introduced after F7.1?

# F8.1 open questions

- Which provider will export structured logs and low-cardinality metrics?
- What production proxy topology and HSTS subdomain policy will operations approve?
- What shutdown/drain deadline does the eventual orchestrator guarantee?

# F9.3 open questions

- Should a future audited export workflow exist for support cases? F9.3 deliberately provides no
  export.
- Should notification attempt history receive its own safe Backend projection? F9.3 does not infer
  or reconstruct attempts absent that contract.

# F10 provisioning decisions

Select the VPS/provider and jurisdiction, domain topology, SMTP provider, backup destination and
retention, container scanner, monitoring destination, incident owners, and approved initial
capacity before provisioning.
