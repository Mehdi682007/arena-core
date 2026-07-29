# Dependency security

## Production audit

- RC version: `0.1.0-rc.1`
- Audit timestamp (UTC): `2026-07-27T22:38:07Z`
- Command: `pnpm audit --prod`
- Registry: `registry.npmjs.org`
- Network status: online, official npm registry only
- Scope: production dependencies only
- Exit code: 0
- Result: no known vulnerabilities
- Remediation status: none required; no automatic fix was run

| Severity | Count | Direct | Transitive | Remediated | Accepted | Unresolved |
| -------- | ----: | -----: | ---------: | ---------: | -------: | ---------: |
| Critical |     0 |      0 |          0 |          0 |        0 |          0 |
| High     |     0 |      0 |          0 |          0 |        0 |          0 |
| Moderate |     0 |      0 |          0 |          0 |        0 |          0 |
| Low      |     0 |      0 |          0 |          0 |        0 |          0 |
| Info     |     0 |      0 |          0 |          0 |        0 |          0 |

There were no advisories to remediate, accept, or analyze for runtime reachability. No package
manifest, version, override, or lockfile entry was changed.

Automatic fixes are prohibited. Do not use `pnpm audit --fix`, `npm audit fix`, forced upgrades, or
unreviewed broad overrides. Re-run the production audit on every release candidate and after every
dependency change; perform a scheduled review at least monthly while the product is deployed.

The audit sends dependency names and versions to the official npm advisory service. It does not
upload source files, environment files, application secrets, or repository contents.

# RC audit policy

`pnpm audit --prod` is a mandatory F9.4 gate. Any unresolved critical/high production advisory is a
release BLOCKER; network-unavailable audit execution cannot be reported as a pass.
