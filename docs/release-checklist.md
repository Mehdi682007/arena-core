# Release checklist

This checklist creates and verifies artifacts; it does not authorize deployment.

For `0.1.0-rc.1`, also complete `release-candidate-checklist.md` and retain the F9.4 golden-journey
integration test output.

## Build identity

- Select an immutable release version and full Git commit SHA.
- Set `RELEASE_VERSION`, `BUILD_SHA`, and `SOURCE_DATE_EPOCH`.
- Generate `release/manifest.json` into an empty release workspace with `pnpm release:manifest`.
- Confirm every image tag is `<version>-<12-character SHA>`; mutable tags are forbidden.
- Run `pnpm release:verify` and retain the manifest with the build logs.

## Quality and security

- Run `pnpm install --frozen-lockfile`, format check, lint, typecheck, test, build, Prisma
  validation, and `pnpm audit --prod`.
- Run `pnpm release:preflight`; run `pnpm release:preflight:full` only where Docker Compose is
  installed.
- Build all five targets (`api`, `worker`, `web`, `migrate`, `seed`) without pushing them.
- Scan built images with the organization's approved scanner and record exceptions. No scanner is
  bundled or simulated by this repository.
- Check the Web bundle for server-only names and secret-like values.

## Database and rollout

- Create and independently verify a PostgreSQL backup.
- Review the 13 migration checksums in the release manifest.
- Run `arena-migrate` as a one-shot job; never start API, Worker, or Web with migration commands.
- Roll out API, Worker, and Web only after migration success.
- Run `pnpm release:smoke` against private staging URLs.
- Seed is manual-only: enable the `seed` profile only when the FC 26 catalog is intentionally
  required.

## Rollback

- Stop rollout, retain logs and the failed image digest, and roll application images back to the
  prior immutable tag.
- Do not automatically reverse database migrations. Determine forward-fix versus restore from the
  reviewed migration and backup impact.
- If restore is authorized, follow the database runbook and restore into an isolated target first.
