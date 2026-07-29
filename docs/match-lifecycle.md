# Match Lifecycle

```mermaid
stateDiagram-v2
  [*] --> PROPOSED
  PROPOSED --> ACCEPTING
  ACCEPTING --> READY: both accept and funds lock
  ACCEPTING --> CANCELLED: decline or timeout
  READY --> IN_PROGRESS: start condition
  IN_PROGRESS --> AWAITING_RESULTS
  AWAITING_RESULTS --> VERIFIED: submissions agree
  AWAITING_RESULTS --> DISPUTED: submissions conflict or claim
  DISPUTED --> VERIFIED: reviewer decides winner
  DISPUTED --> CANCELLED: reviewer refunds
  VERIFIED --> SETTLED: idempotent settlement
  CANCELLED --> REFUNDED
  SETTLED --> [*]
  REFUNDED --> [*]
```

Every transition records actor, reason, prior/new state, request/correlation ID, and timestamp. A transition and its financial side effect commit atomically where both are authoritative. Terminal states reject further mutation except audited administrative correction through a compensating transaction.

Timeout jobs carry the expected state/version so stale jobs become no-ops. `SETTLED` and `REFUNDED` are mutually exclusive.
