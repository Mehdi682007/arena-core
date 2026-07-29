# @arena-core/admin-operations

Backend-only F7.2 boundary for append-only administrative audit, safe search/timeline projections,
and notification retry/recovery delegation.

The domain/application layers are framework independent. Prisma exists only in `infrastructure`;
NestJS composition exists in `apps/api`. This package has no balance, result, dispute, settlement
or rating mutation API.

See [`docs/administrative-operations.md`](../../docs/administrative-operations.md) and
[ADR-0027](../../docs/adr/0027-administrative-operations-and-audit.md).
