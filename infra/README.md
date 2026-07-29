# Arena server automation

This directory is the reusable, version-controlled F10 automation framework for Ubuntu 22.04/24.04
on amd64 or arm64. It provisions staging by IP without TLS and can later use a production inventory
with domain/TLS requirements. It never stores SSH passwords or real application secrets.

Core flow:

```text
bootstrap-remote -> bootstrap/provision -> verify second SSH session -> finalize SSH
                 -> transfer immutable release -> prepare runtime env -> deploy -> verify
```

Read `docs/discovery.md`, `docs/bootstrap.md`, `docs/deployment.md`, `docs/secrets.md`,
`docs/rollback.md`, and `docs/troubleshooting.md` before use. Core scripts are non-interactive;
restore and rollback require explicit environment confirmations.

Local validation:

```bash
bash infra/tests/run.sh
shellcheck infra/scripts/*.sh infra/scripts/lib/*.sh
docker compose --env-file infra/tests/fixtures/compose.env \
  -f infra/compose/compose.base.yml -f infra/compose/compose.automation.staging.yml config --quiet
```

Passing local checks means the framework is implemented, not that a real server is provisioned.
