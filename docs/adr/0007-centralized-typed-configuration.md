# ADR-0007: Centralized typed environment configuration

- Status: Accepted
- Date: 2026-07-25

## Context

Web, API, and Worker need consistent environment parsing without scattered `process.env` reads, permissive coercion, accidental browser exposure, or secret-bearing errors.

## Decision

`@arena-core/config` is a framework-neutral CommonJS package using Zod schemas. Each application creates one immutable, app-specific config before bootstrap. Nest applications inject runtime values through tokens. Web exports only its explicit public projection to rendered UI. Known invalid values fail fast; unknown values are ignored. Development/test receive safe defaults, while staging/production require operational values. API CORS uses a normalized origin allowlist and forbids wildcard outside local/test use. Worker graceful shutdown is bounded by a validated timeout.

The package verifies the active Node version against the root engine range and warns in development when it differs from the recommended `.nvmrc` patch. Validation errors disclose variable names and constraints, never raw values.

Next.js remains responsible for its local env-file behavior. API and Worker consume environment values supplied by their process runner, so no additional dotenv loader is introduced.

## Consequences

Configuration behavior is reusable and directly unit-testable without mutating global process state. Adding a setting requires schema, ownership, documentation, and boundary tests. Deployments must explicitly provide staging/production operational values and will stop before binding ports when invalid.
