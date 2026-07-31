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
`worker`, and `web` one target at a time, tags them with either the full source commit or release
ID, pushes them, resolves registry digests, and emits `deployment-images.json`.

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
It then optionally logs in using a temporary `DOCKER_CONFIG`, pulls and inspects the four runtime
and migration references, runs the prebuilt migration image, starts API/Worker/Web, performs
existing health verification, and only then updates `current`. The fifth digest-pinned reference
is the separately invoked Seed image. A pull failure is fatal and never falls back to a local
build. The temporary Docker credential directory is removed on exit, so credentials are not
persisted in root's normal Docker configuration.

Deployment metadata records the deploy mode, deployment-manifest SHA-256, and exact image
references. Automatic and manual rollback load the target release's own
`release/deployment-images.json`, recreate its containers from those immutable references, and
verify health. Database migrations are not reversed.

## Local build mode

On a sufficiently sized build host, explicitly configure:

```dotenv
DEPLOY_MODE=build-local
```

Then run the same deployment command without `--build`. The canonical automation selects
`compose.build-local.yml` and builds `arena-migrate`, `arena-api`, `arena-worker`, and `arena-web`
as four independent sequential commands. The next service build starts only after the previous
one succeeds.

## Compose selection and PostgreSQL

Automation uses `compose.base.yml`, optionally `compose.build-local.yml`, and exactly one
`compose.automation.staging.yml` or `compose.automation.production.yml`. Legacy/local Compose files
remain separate and are never selected by automation.

Use `POSTGRES_MODE=container` for the profiled local database or `POSTGRES_MODE=external` with
file-backed `DATABASE_URL` and `DATABASE_DIRECT_URL` for managed PostgreSQL. Baseline seed remains
a separate explicit operation. Production requires a domain and TLS inventory; certificate
issuance remains outside this framework phase. Never run `docker compose down -v`.

## Staging limitation

The prebuilt path has local regression/config validation only. Images have not yet been published
and the path has not yet been exercised on staging. F10.1 therefore remains PARTIAL. After explicit
approval and image publication, Phase 4 must prove that no BuildKit, pnpm, Turbo, or source build
starts on the VPS, followed by at least 15 minutes of runtime resource monitoring.
