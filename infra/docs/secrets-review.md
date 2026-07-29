# Secrets review

Container mode requires `POSTGRES_PASSWORD`; external mode requires `DATABASE_URL` and
`DATABASE_DIRECT_URL`. Both require `SESSION_SECRET`, `CSRF_SECRET`, `AUTH_TOKEN_HASH_KEY`, and
`AUTH_IP_HASH_KEY`. Files under `/opt/arena/shared/secrets` must be regular mode `0400/0600`.

Values are operator-supplied/generated directly into files and never regenerated. PostgreSQL uses
`POSTGRES_PASSWORD_FILE`. Because the app lacks universal `_FILE` support, a runtime-user-owned
`0600` env file adapts the rest without logging. Compose config contains paths, not values; Docker
inspect by privileged operators can see application environment values. Rotation atomically
replaces secret files, rerenders runtime env, and restarts affected services. Missing/unsafe files
fail closed.
