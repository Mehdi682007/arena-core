# Release candidate checklist

## Identity and integrity

- [x] RC version, build SHA (`uncommitted` only before first commit), and timestamp recorded
- [x] Lockfile and all package manifest hashes recorded
- [x] 13 migration hashes match the release manifest
- [x] Latest migration is `20260731120000_create_admin_audit_events`
- [x] Production audit passed online against `registry.npmjs.org` with zero advisories

## Verification

- [x] Frozen install, Prisma, seed, format, lint, typecheck, test, build, and check gates pass
- [x] Clean cache-independent build and test pass
- [x] API/Web route and shared-contract inventories reviewed
- [x] Golden journey integration gate passes
- [x] Security/privacy matrices and client-bundle scans pass
- [x] No production mock, impersonation, destructive Admin UI, or open proxy exists

## Artifacts

- [x] RC manifest and immutable image tags verified
- [x] API, Worker, Web, migrate, and seed build targets statically verified
- [x] Dockerfile, Compose, CI, backup/restore, and smoke scripts statically verified
- [x] Documentation links and F10 handoff complete

## Runtime items transferred to F10

- [ ] Docker/Compose runtime
- [ ] Fresh PostgreSQL migration and seed
- [ ] SMTP delivery
- [ ] Backup and isolated restore
- [ ] Container vulnerability scan
- [ ] TLS/domain and live smoke

Approval: Product ___ Security ___ Operations ___ Date/time ___
