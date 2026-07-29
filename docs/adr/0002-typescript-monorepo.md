# ADR-0002: TypeScript Monorepo

Status: Accepted

## Context

The requested web and API stacks are TypeScript and need shared contracts, configuration, UI, and quality gates.

## Decision

Use pnpm workspaces with Turborepo; Next.js for web; NestJS for API/worker; shared packages only for stable cross-cutting contracts.

## Consequences

Tooling and types are consistent. Package boundaries must be checked to prevent an accidental distributed monolith inside one repository.
