# `@arena-core/wallet`

F5.2 adds `MATCH_ESCROW`, `MATCH_ENTRY_RESERVATION`, and `MATCH_ENTRY_REFUND` for
match-specific non-monetary entry custody. Release changes reservation state only. Final
distribution and platform-share accounting are not implemented.

This bounded context provides an auditable, non-monetary `ARENA_POINT` balance. Arena
Points have no guaranteed cash value, conversion rate, transfer, deposit, or withdrawal.

The ledger uses positive `bigint` entry amounts and explicit debit/credit directions.
Credits increase a user available balance and debits decrease it. Every posted operation
has balanced user/system entries; entries are immutable and corrections require a linked
reversal. `LedgerAccount.currentBalance` is an atomic projection while entries remain the
source of truth. User balances cannot become negative.

Wallets and their available account are created lazily. Exact idempotent retries return
the original transaction; a changed request conflicts. Reconciliation compares the
projection with the entry sum, records an audit event, and never auto-fixes data.

User HTTP operations are read-only. Issuance, adjustment, reversal, and reconciliation
are permission-protected administrative operations. With the database disabled these
operations fail closed with `WALLET_SERVICE_UNAVAILABLE`.

Settlement uses `MATCH_WINNER_SETTLEMENT`, `MATCH_DRAW_REFUND`, and `MATCH_VOID_REFUND`.
Each transaction debits match escrow and credits user-available ARENA_POINT with balanced
entries. Winner settlement is non-monetary and has no platform deduction.
