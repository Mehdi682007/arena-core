# Deployment

## Build-time and runtime capacity

Real staging evidence proves that an on-host source build is not safe on the tested 4 GB RAM /
2 GB swap VPS. Even when Compose services were built sequentially, the first workspace build used
up to 13 pnpm and 23 Node processes and reached the OOM guard threshold. This is a build-time
finding only. Runtime capacity is not yet known and must not be described as 4 GB-compatible until
a prebuilt deployment has run under observation for at least 15 minutes.

## Explicit deployment modes

Every automation inventory must set one of:

```dotenv
DEPLOY_MODE=prebuilt
DEPLOY_MODE=build-local
```

There is no implicit default. Unknown or missing values fail before deployment mutation.
Staging and production examples use `prebuilt`. `build-local` is retained for local development or
an explicitly authorized build host with sufficient memory.

## Build and publish prebuilt images

The manual GitHub Actions workflow `.github/workflows/prebuilt-images.yml` checks out the triggering
commit and calls `scripts/release/build-prebuilt-images.sh`. The script builds `migrate`, `api`,
`worker`, `web`, and `seed` one target at a time, tags them with either the full source commit or
release ID, pushes them, resolves registry digests, and emits `deployment-images.json`.

For a separately authenticated build host:

```bash
export ARENA_REGISTRY=ghcr.io/OWNER
export ARENA_IMAGE_TAG="$(git rev-parse HEAD)"
export RELEASE_ID=0.1.0-staging.1
export SOURCE_COMMIT="$(git rev-parse HEAD)"
export IMAGE_MANIFEST_OUTPUT=deployment-images.json
bash scripts/release/build-prebuilt-images.sh
```

`latest` is forbidden. `ARENA_IMAGE_TAG` must equal the full source commit or release ID. Copy the
resulting manifest into the release before packaging:

```bash
install -m 0644 deployment-images.json release/deployment-images.json
python3 infra/scripts/validate-image-manifest.py \
  release/deployment-images.json "$RELEASE_ID"
```

The committed `release/deployment-images.example.json` documents the schema. Each of the five
entries contains `name`, immutable `tag`, `digest`, and an exact `name:tag@digest` reference.

## Prebuilt deployment

Create a release archive without `.git`, `.env`, host `node_modules`, caches, registry credentials,
or runtime secrets. Calculate SHA-256 locally, copy it to the VPS, verify it there, and extract it
under `/opt/arena/releases/RELEASE_ID`.

Required non-secret inventory values include:

```dotenv
DEPLOY_MODE=prebuilt
DEPLOY_BASELINE_SEED_ENABLED=false
ALLOW_PRODUCTION_BASELINE_SEED=false
RELEASE_VERSION=0.1.0-staging.1
POSTGRES_MODE=container
REGISTRY_USERNAME=
REGISTRY_TOKEN_FILE=
```

For public images, leave both registry credential variables empty. For private images, set
`REGISTRY_USERNAME` and an absolute `REGISTRY_TOKEN_FILE`. The token file must be a regular,
non-symlink file with mode `0400` or `0600`; its contents are read through `docker login
--password-stdin` and never logged.

Validate and deploy:

```bash
sudo infra/scripts/prepare-runtime-env.sh /secure/path/arena-staging.env
sudo infra/scripts/deploy.sh /secure/path/arena-staging.env --dry-run
sudo infra/scripts/deploy.sh /secure/path/arena-staging.env
```

`backup.sh` independently loads and validates the target release's five-image
`release/deployment-images.json` before Compose interpolation. Operators must not manually export
`ARENA_*_IMAGE` variables. Missing, mutable, malformed, or release-mismatched image entries fail
before the backup lock, partial directory, or `pg_dump`. A custom-format dump is finalized only
after `pg_restore -l` and the checksum manifest succeed.

Prebuilt deployment validates the manifest and registry token before acquiring the lifecycle lock.
It then optionally logs in using a temporary `DOCKER_CONFIG`, pulls and inspects all five immutable
image references, creates a database backup, runs the prebuilt migration image, optionally runs the
official Seed image, activates API/Worker/Web, verifies readiness, updates `current`, and records the
deployment. A pull failure is fatal and never falls back to a local build. The temporary Docker
credential directory is removed on exit, so credentials are not persisted in root's normal Docker
configuration.

Deployment metadata records the deploy mode, deployment-manifest SHA-256, and exact image
references. Automatic and manual rollback load the target release's own
`release/deployment-images.json`, recreate its containers from those immutable references, and
verify health. Database migrations and committed Seed transactions are not automatically reversed.

## Baseline Seed during deployment

Baseline Seed is disabled by default:

```dotenv
DEPLOY_BASELINE_SEED_ENABLED=false
ALLOW_PRODUCTION_BASELINE_SEED=false
```

In staging, `DEPLOY_BASELINE_SEED_ENABLED=true` enables Seed execution after migration and before
application activation. `ALLOW_PRODUCTION_BASELINE_SEED` does not control staging.

Production requires both explicit opt-ins:

| `DEPLOY_BASELINE_SEED_ENABLED` | `ALLOW_PRODUCTION_BASELINE_SEED` | Result                                          |
| ------------------------------ | -------------------------------- | ----------------------------------------------- |
| `false`                        | `false`                          | Seed is skipped                                 |
| `false`                        | `true`                           | Seed is skipped                                 |
| `true`                         | `false`                          | Validation fails before deployment mutation     |
| `true`                         | `true`                           | Seed runs after migration and before activation |

Both values accept only the literal values `true` and `false`. Invalid values fail validation,
including during `--dry-run`.

Deployment invokes the official `infra/scripts/seed.sh`; Seed logic is not duplicated inside
`deploy.sh`. The parent deployment already holds `deploy.lock`, so nested Seed execution acquires
only `seed.lock`. A standalone Seed execution acquires `deploy.lock` followed by `seed.lock`.

Dry-run validates the inventory, immutable Seed image reference, and Compose contract without
acquiring locks, starting containers, creating backups, running migrations, or mutating runtime
state.

A Seed failure stops deployment before application activation, health verification, `current`
symlink replacement, and deployment recording. It does not automatically restore the database or
reverse migration and Seed transactions that already committed.

## Local build mode

On a sufficiently sized build host, explicitly configure:

```dotenv
DEPLOY_MODE=build-local
```

Then run the same deployment command without `--build`. The canonical automation selects
`compose.build-local.yml` and sequentially builds `arena-migrate`, `arena-api`, `arena-worker`, and
`arena-web`. When `DEPLOY_BASELINE_SEED_ENABLED=true`, it also builds `arena-seed`. The next service
build starts only after the previous one succeeds, and all required builds finish before backup,
migration, or any other database mutation.

## Compose selection and PostgreSQL

Automation uses `compose.base.yml`, optionally `compose.build-local.yml`, and exactly one
`compose.automation.staging.yml` or `compose.automation.production.yml`. Legacy/local Compose files
remain separate and are never selected by automation.

Use `POSTGRES_MODE=container` for the profiled local database or `POSTGRES_MODE=external` with
file-backed `DATABASE_URL` and `DATABASE_DIRECT_URL` for managed PostgreSQL. Baseline Seed is an
explicitly gated part of the deployment lifecycle when enabled. Production requires a domain and
TLS inventory; certificate issuance remains outside this framework phase. Never run
`docker compose down -v`.

## Persistent site assets

The API stores administrator-uploaded branding assets under the validated runtime path
`ARENA_SITE_ASSET_ROOT=/app/var/site-assets`. Automation bind-mounts that path from
`$SERVER_APP_ROOT/shared/uploads/site-assets`, owned by the runtime application user. The API
rejects staging or production startup when the path is omitted, relative, or not writable. This
directory is persistent across container replacement and is already included in the canonical
backup and restore upload contract. Operators must not point the setting at a release directory or
another container-local path.

## Staging limitation

The prebuilt path has local regression/config validation only. Images have not yet been published
and the path has not yet been exercised on staging. F10.1 therefore remains PARTIAL. After explicit
approval and image publication, Phase 4 must prove that no BuildKit, pnpm, Turbo, or source build
starts on the VPS, followed by at least 15 minutes of runtime resource monitoring.

## Immutable release installation

`RELEASE_ARCHIVE` must be named `arena-release-$RELEASE_VERSION.tar.gz` and accompanied by its
trusted `RELEASE_ARCHIVE_SHA256`. Run `install-release.sh INVENTORY --dry-run` before the real
installer. The installer validates the archive path safety, release ID, build SHA and deployment
image source commit before taking the lifecycle lock, extracts into a private incoming directory,
and atomically renames it. An existing release directory is never overwritten. A failed or manually
modified release ID is tainted: preserve it for evidence and publish a new immutable release rather
than patching it in place. `deploy.sh` validates the same archive identity but never re-extracts it.

For external PostgreSQL, the canonical file-backed URLs use `host.docker.internal`. Every temporary
PostgreSQL utility container adds `host.docker.internal:host-gateway`; do not persist a Docker bridge
IP such as `172.17.0.1` in application secrets.
