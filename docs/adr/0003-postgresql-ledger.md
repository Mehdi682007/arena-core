# ADR-0003: PostgreSQL Authority and Double-entry Ledger

Status: Accepted

## Context

Wallet locks and settlement require atomicity, auditability, concurrency control, and replay protection.

## Decision

PostgreSQL is authoritative. Use immutable double-entry postings with integer minor units, unique idempotency scopes, and transactional outbox records. Redis is never authoritative for funds.

## Consequences

Financial history is reconstructable and reconciliation is possible. Corrections require compensating entries and careful transaction design.
