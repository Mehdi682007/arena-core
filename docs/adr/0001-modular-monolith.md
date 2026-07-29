# ADR-0001: Modular Monolith

Status: Accepted

## Context

The MVP has strongly consistent match and financial workflows but broad domain scope. Microservices would add distributed transactions, operations, and delivery overhead.

## Decision

Deploy the backend as a modular monolith plus a separately running worker from the same codebase. Enforce bounded contexts through module exports and contracts.

## Consequences

Transactions and debugging stay simple. Independent service scaling is deferred. Modules with proven scaling or ownership needs may later be extracted behind existing contracts.
