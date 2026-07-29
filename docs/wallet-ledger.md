# Wallet and Ledger

## Model

The wallet is a user-facing projection over an immutable double-entry ledger. Amounts are integers in minor units. MVP supports one test-credit currency; multi-currency schema is retained but cross-currency posting is forbidden.

Accounts include player available, player locked, platform commission, prize pool/escrow, and system issuance/burn accounts.

## Posting examples

- Admin test credit: system issuance debit; player available credit.
- Entry lock: player available debit; player locked credit.
- Refund: player locked debit; player available credit.
- Settlement: both locked accounts debit; winner available and platform commission accounts credit.

## Invariants

- Every transaction balances.
- Entries are append-only.
- A match has one terminal settlement.
- Each sensitive command requires an idempotency key.
- Negative available balance is forbidden.
- Balance checks, ledger entries, idempotency record, match settlement, and outbox message commit in one database transaction.
- Corrections use compensating entries; history is never edited.

## Reconciliation

A scheduled job compares ledger-derived balances with cached projections, checks unbalanced transactions and orphan locks, and emits alerts without silently repairing data.

Real-money adapters and withdrawals remain disabled by feature flag and absent from public API until legal, security, and payment-provider approval.
