# Matches

## Match start and result lifecycle

Either participant may idempotently move a fully-ready Match to `IN_PROGRESS`. Server time sets
`startedAt` and the result-submission deadline. Participants submit immutable canonical score
records; replacement creates a new record and supersedes the old one.

Matching submissions auto-confirm and complete the Match. Different submissions enter
`RESULT_CONFLICT`; neither side is selected as winner. Draw validity comes from the Match ruleset
snapshot. Before an opponent submits, a participant may withdraw and return the Match to
`IN_PROGRESS`.

Administrators may read and resolve conflicts through typed permissions and audited reasons.
Expiration never awards an automatic win. This package contains no evidence storage, complete
dispute workflow, Wallet, reward, Rating, queue or external game API.

`@arena-core/matches` owns creation of a durable match from an accepted matchmaking proposal,
immutable participant/catalog snapshots, ready confirmation, pre-ready cancellation, expiration,
and audited admin voiding. Domain and application code are independent of NestJS and Prisma.

Creation re-reads the accepted proposal, matched requests, verified accounts, catalog records, and
published ruleset. A unique proposal relation plus a short transaction provides idempotent
exactly-once persistence. An accepted proposal without a match remains recoverable through the
bounded `createMissingMatchesForAcceptedProposals` use case; no startup loop or worker polling is
introduced.

Snapshots are versioned JSON objects, size/depth limited, immutable after creation, and reject
credentials, tokens, email, IP/session data, normalized handles, and verification metadata. Users
see only display handles, platform labels, side, ready state, and whether a participant is
themselves.

F4.2 supports `CREATED`, `AWAITING_READY`, `READY`, `CANCELLED`, `EXPIRED`, and `VOIDED`.
Cancellation is allowed only before `READY`; pending participants remain historical on expiry.
Admin voids require `matches.manage` and append an audit event. No result, score, evidence,
dispute, wallet, rating, queue, scheduler, or runtime in-memory store exists.

When the database is disabled, API startup remains healthy and match operations fail closed with
`MATCH_SERVICE_UNAVAILABLE`. PostgreSQL runtime constraints and transaction races require a real
PostgreSQL service and are not claimed by adapter tests.

# F4.4 evidence and disputes

Match evidence is declaration metadata only; no file, URL, path, MIME data, checksum, or object
storage reference is accepted. Participants can submit and withdraw active declarations. Evidence
used by a dispute claim or response is locked.

The dispute flow is `AWAITING_RESPONSE -> UNDER_REVIEW -> RESOLVED|REJECTED`, with cancellation
before response and bounded expiration into review. Reviewers self-assign, and only the assigned
reviewer may uphold, correct, void, or reject. Corrections and voids preserve the prior result in an
append-only revision. Expiration never auto-resolves or awards a win. There are no wallet or rating
effects.
