# Deployment discovery

Arena Core is a pnpm/Turbo TypeScript monorepo with 19 workspace projects. The release container
contract is defined by `docker/Dockerfile`, with non-root targets for API (`3001`), Web (`3000`),
Worker, Prisma migrate, and the idempotent FC 26 seed. PostgreSQL 17 is the only required runtime
data service. Redis, MinIO, and Mailpit in `infra/compose/docker-compose.yml` are development-only.

The production topology is NGINX on host ports 80/443, proxying Web and `/api/` to loopback-bound
containers. API and Web are never directly public; Worker and PostgreSQL publish no host ports.
Migrations use `pnpm db:migrate:deploy`; status uses `pnpm db:migrate:status`; baseline seed uses
`pnpm db:seed:fc26`. Health endpoints are `/health`, `/api/health`, `/api/v1/health`, and
`/api/v1/health/ready`. Database backup and guarded restore primitives already exist under
`scripts/database`.

Release identity is read from `release/manifest.json`. The framework must preserve its lockfile and
13 migration checksums. Staging may use HTTP by IP; production inventory requires a domain and TLS.
