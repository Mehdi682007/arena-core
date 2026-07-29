# ADR-0006: Unified Health Contract and Vitest

Status: Accepted

## Context

Web, API, and worker need consistent health metadata without coupling framework code. A single test runner reduces tooling and maintenance overhead.

## Decision

Define framework-neutral health types in `@arena-core/contracts`. Use Vitest for all three applications. Nest integration tests consume compiled output so TypeScript decorator metadata matches production runtime.

## Consequences

Health response shapes remain aligned and tests use one runner. Nest package tests build before running, adding a small local cost while validating the actual emitted runtime.
