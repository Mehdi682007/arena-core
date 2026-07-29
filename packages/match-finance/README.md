# `@arena-core/match-finance`

This framework-neutral boundary reserves non-monetary `ARENA_POINT` for Match entry.

- Requirements come only from immutable Match ruleset snapshots; missing configuration creates a
  zero `NOT_REQUIRED` reservation.
- Required entry debits `USER_AVAILABLE` and credits match-specific `MATCH_ESCROW` through one
  double-entry transaction.
- One reservation exists per Match participant. Idempotency binds Match, participant, user, asset,
  amount, and operation.
- Ready/start use an eligibility port. Start changes `RESERVED` to `RELEASED` without ledger
  movement.
- Pre-start cancellation, expiry, void, or audited operational recovery may create a separate
  balanced refund transaction.
- Reconciliation reports escrow drift and never auto-fixes.
- Public views omit Wallet, account, ledger, fingerprint, actor, and system identifiers.
- Disabled database mode keeps routes registered and returns a redacted 503.

No final distribution, platform share, external provider, real currency, or background worker is
implemented. Test adapters are not production persistence.

## Match settlement

After the dispute delay, a confirmed or admin-resolved result can settle the match-specific
ARENA_POINT escrow. Winner-takes-all credits the result-derived winner; draw and void outcomes
return each participant's actual reservation amount. Posting and reservation finalization are
atomic and idempotent. Active disputes block settlement, retention is always zero, and
reconciliation never auto-fixes ledger state.
