# Compose review

```bash
docker compose --env-file infra/tests/compose-validation.env \
  -f infra/compose/compose.base.yml \
  -f infra/compose/compose.automation.staging.yml config
```

Result here: **NOT EXECUTED — Docker unavailable**.

Required variables: `ARENA_RELEASE_DIR`, `ARENA_ENV_FILE`, `ARENA_SECRETS_DIR`, `BUILD_SHA`,
`RELEASE_VERSION`, `IMAGE_TAG`, `POSTGRES_DB`, and `POSTGRES_USER`.

Services: PostgreSQL 17.10, API, Web, Worker, one-shot migrate, and profile-only seed. PostgreSQL has
a health check and named volume. Apps are read-only, non-root, capability-dropped, restart-managed,
and log-rotated. API/Web are loopback-only; DB is private. Networks `app` and `data` are internal.
PostgreSQL uses a mounted `_FILE` secret; apps use a restricted env file. Staging supports IP/HTTP
and container DB; production supports external DB and requires domain/TLS inventory policy.
