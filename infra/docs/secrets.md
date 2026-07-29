# Secrets

Required names can be listed without values:

```bash
source infra/scripts/lib/secrets.sh
required_secret_names
```

Create each named file under `/opt/arena/shared/secrets` as root, mode `0600`, owned by the runtime
user. Generate values with a cryptographically secure tool such as `openssl rand -base64 48`, but
redirect output directly to the file and never paste it into inventory, logs, shell arguments, or
Git. `prepare-runtime-env.sh` adapts secret files to the application's current environment-variable
contract in one restricted `0600` file without printing values. Container mode requires
`POSTGRES_PASSWORD`; external mode instead requires `DATABASE_URL` and `DATABASE_DIRECT_URL` secret
files. SMTP remains disabled in staging.

The application currently accepts these values only as environment variables. Therefore the
restricted runtime file is mounted through Compose `env_file`; only PostgreSQL itself consumes
`POSTGRES_PASSWORD_FILE` directly. This is an application-contract limitation, not a claim that all
application secrets remain file-backed inside containers.

Private image registries use a separate operator-owned token file referenced by
`REGISTRY_TOKEN_FILE`; the token is not copied into the release, runtime environment, Compose
configuration, or deployment manifest. Use mode `0400` or `0600`. `deploy.sh` passes it to
`docker login` through standard input with logging disabled and uses a temporary mode-`0700`
`DOCKER_CONFIG`. The temporary credential directory is deleted when deployment exits. Public
staging registries require neither `REGISTRY_USERNAME` nor `REGISTRY_TOKEN_FILE`.
