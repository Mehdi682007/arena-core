#!/usr/bin/env bash
set -Eeuo pipefail

release_id=0.0.0-backup-ci
source_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
digest="sha256:$(printf 'b%.0s' {1..64})"
work="$(mktemp -d)"
app_root="$work/arena"
backup_root="$work/backups"
inventory="$work/staging-prebuilt-backup.env"
project=arena

cleanup() {
  export ARENA_ENV_FILE="$app_root/shared/env/runtime.env"
  export ARENA_SECRETS_DIR="$app_root/shared/secrets"
  export POSTGRES_DB=arena_backup
  export POSTGRES_USER=arena_backup
  for service in migrate api worker web seed; do
    variable="ARENA_${service^^}_IMAGE"
    printf -v "$variable" 'ghcr.io/example/arena-%s:%s@%s' \
      "$service" "$source_commit" "$digest"
    export "$variable"
  done
  docker compose --project-directory . \
    -f infra/compose/compose.base.yml \
    -f infra/compose/compose.automation.staging.yml \
    --profile container-db down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p \
  "$app_root/releases/$release_id/release" \
  "$app_root/shared/env" \
  "$app_root/shared/secrets" \
  "$app_root/shared/uploads" \
  "$app_root/run" \
  "$app_root/logs" \
  "$backup_root"
printf 'backup-ci-secret\n' >"$app_root/shared/secrets/POSTGRES_PASSWORD"
chmod 0600 "$app_root/shared/secrets/POSTGRES_PASSWORD"
touch "$app_root/shared/env/runtime.env"
printf '{"release":"previous"}\n' >"$app_root/shared/deployment.json"

cat >"$inventory" <<EOF
ENVIRONMENT=staging
SERVER_HOST=127.0.0.1
SERVER_SSH_PORT=22
SERVER_INITIAL_USER=root
SERVER_OPERATOR_USER=arena
SERVER_APP_USER=arenaapp
SERVER_APP_ROOT=$app_root
SERVER_BACKUP_ROOT=$backup_root
OPERATOR_PUBLIC_KEY_FILE=
APP_DOMAIN=
APP_HTTP_PORT=80
ENABLE_TLS=false
ENABLE_UFW=false
ENABLE_FAIL2BAN=false
ENABLE_UNATTENDED_UPDATES=false
ENABLE_SWAP=false
SWAP_SIZE_GB=0
SSH_ALLOW_TCP_FORWARDING=false
OPERATOR_DOCKER_GROUP=false
POSTGRES_MODE=container
POSTGRES_DB=arena_backup
POSTGRES_USER=arena_backup
DEPLOY_MODE=prebuilt
REGISTRY_USERNAME=
REGISTRY_TOKEN_FILE=
RELEASE_VERSION=$release_id
BUILD_SHA=$source_commit
RELEASE_ARCHIVE=
ALLOW_SUPPORTED_OS_OVERRIDE=true
EOF

python3 - "$app_root/releases/$release_id/release/deployment-images.json" \
  "$release_id" "$source_commit" "$digest" <<'PY'
import datetime
import json
import sys

path, release_id, source_commit, digest = sys.argv[1:]
images = {}
for service in ("migrate", "api", "worker", "web", "seed"):
    name = f"ghcr.io/example/arena-{service}"
    images[service] = {
        "name": name,
        "tag": source_commit,
        "digest": digest,
        "reference": f"{name}:{source_commit}@{digest}",
    }
manifest = {
    "schemaVersion": 1,
    "releaseId": release_id,
    "sourceCommit": source_commit,
    "buildTimestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "images": images,
}
with open(path, "w", encoding="utf-8") as target:
    json.dump(manifest, target)
    target.write("\n")
PY
cp "$app_root/releases/$release_id/release/deployment-images.json" "$work/good.json"
printf '{"releaseVersion":"%s","buildSha":"%s"}\n' \
  "$release_id" "$source_commit" >"$app_root/releases/$release_id/release/manifest.json"

export ARENA_ENV_FILE="$app_root/shared/env/runtime.env"
export ARENA_SECRETS_DIR="$app_root/shared/secrets"
export POSTGRES_DB=arena_backup
export POSTGRES_USER=arena_backup
for service in migrate api worker web seed; do
  variable="ARENA_${service^^}_IMAGE"
  printf -v "$variable" 'ghcr.io/example/arena-%s:%s@%s' \
    "$service" "$source_commit" "$digest"
  export "$variable"
done
docker compose --project-directory . \
  -f infra/compose/compose.base.yml \
  -f infra/compose/compose.automation.staging.yml \
  --profile container-db up -d --wait postgres
#unset ARENA_MIGRATE_IMAGE ARENA_API_IMAGE ARENA_WORKER_IMAGE ARENA_WEB_IMAGE ARENA_SEED_IMAGE

if ! BACKUP_MIN_FREE_MB=1 \
  bash infra/scripts/backup.sh "$inventory" >"$work/backup.log" 2>&1; then
  echo "tracked backup invocation failed; bounded sanitized diagnostics follow" >&2
  sed -E \
    -e 's#(postgresql://[^:[:space:]]+:)[^@[:space:]]+@#\1[REDACTED]@#g' \
    -e 's#(password|token|secret)([=:][[:space:]]*)[^[:space:]]+#\1\2[REDACTED]#Ig' \
    "$work/backup.log" | tail -n 80 >&2
  exit 1
fi
target="$(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -print -quit)"
[[ -n "$target" && -s "$target/postgres.dump" ]]
[[ "$(head -c 5 "$target/postgres.dump")" == PGDMP ]]
(cd "$target" && sha256sum -c SHA256SUMS)
docker compose --project-directory . \
  -f infra/compose/compose.base.yml \
  -f infra/compose/compose.automation.staging.yml \
  --profile container-db exec -T postgres pg_restore -l <"$target/postgres.dump" >/dev/null
[[ "$(stat -c '%U:%G %a' "$target")" == "root:root 700" ]]
[[ "$(stat -c '%U:%G %a' "$target/postgres.dump")" == "root:root 600" ]]
[[ -f "$target/deployment.json" && -f "$target/secret-inventory.txt" ]]
grep -q './postgres.dump' "$target/SHA256SUMS"
if grep -R -F 'backup-ci-secret' "$work" --include='*.log'; then
  echo "backup logs exposed a credential" >&2
  exit 1
fi

negative_root="$work/negative"
negative_inventory="$work/negative.env"
mkdir -p \
  "$negative_root/releases/$release_id/release" \
  "$negative_root/shared/env" \
  "$negative_root/shared/secrets" \
  "$negative_root/shared/uploads" \
  "$negative_root/run" \
  "$negative_root/logs" \
  "$work/negative-backups"
touch "$negative_root/shared/env/runtime.env"
cp "$app_root/shared/secrets/POSTGRES_PASSWORD" "$negative_root/shared/secrets/"
sed \
  -e "s#^SERVER_APP_ROOT=.*#SERVER_APP_ROOT=$negative_root#" \
  -e "s#^SERVER_BACKUP_ROOT=.*#SERVER_BACKUP_ROOT=$work/negative-backups#" \
  "$inventory" >"$negative_inventory"

expect_manifest_failure() {
  local variant="$1" manifest="$negative_root/releases/$release_id/release/deployment-images.json"
  rm -f "$manifest"
  if [[ "$variant" != missing ]]; then
    cp "$work/good.json" "$manifest"
  fi
  if [[ "$variant" == invalid-path ]]; then
    rm -f "$manifest"
    ln -s "$work/good.json" "$manifest"
  elif [[ "$variant" != missing ]]; then
    python3 - "$manifest" "$variant" <<'PY'
import json
import sys

path, variant = sys.argv[1:]
with open(path, encoding="utf-8") as source:
    value = json.load(source)
if variant == "missing-image":
    del value["images"]["seed"]
elif variant == "mutable":
    image = value["images"]["seed"]
    image["tag"] = "latest"
    image["reference"] = f'{image["name"]}:latest@{image["digest"]}'
elif variant == "bad-digest":
    image = value["images"]["seed"]
    image["digest"] = "sha256:bad"
    image["reference"] = f'{image["name"]}:{image["tag"]}@sha256:bad'
elif variant == "wrong-release":
    value["releaseId"] = "0.0.0-wrong"
elif variant == "wrong-revision":
    value["sourceCommit"] = "c" * 40
    for image in value["images"].values():
        image["tag"] = value["sourceCommit"]
        image["reference"] = f'{image["name"]}:{image["tag"]}@{image["digest"]}'
with open(path, "w", encoding="utf-8") as target:
    json.dump(value, target)
PY
  fi
  if env \
    -u ARENA_MIGRATE_IMAGE \
    -u ARENA_API_IMAGE \
    -u ARENA_WORKER_IMAGE \
    -u ARENA_WEB_IMAGE \
    -u ARENA_SEED_IMAGE \
    BACKUP_TEST_MODE=true \
    bash infra/scripts/backup.sh "$negative_inventory" \
    >"$work/negative-$variant.log" 2>&1; then
    echo "negative manifest unexpectedly passed: $variant" >&2
    exit 1
  fi
  [[ ! -e "$work/negative-backups"/*.partial ]]
}
for variant in missing missing-image mutable bad-digest wrong-release wrong-revision invalid-path; do
  expect_manifest_failure "$variant"
done

failure_root="$work/failure-backups"
failure_inventory="$work/failure.env"
mkdir -p "$failure_root"
sed \
  -e "s#^SERVER_BACKUP_ROOT=.*#SERVER_BACKUP_ROOT=$failure_root#" \
  -e 's/^POSTGRES_DB=.*/POSTGRES_DB=missing_database/' \
  "$inventory" >"$failure_inventory"
if env \
  -u ARENA_MIGRATE_IMAGE \
  -u ARENA_API_IMAGE \
  -u ARENA_WORKER_IMAGE \
  -u ARENA_WEB_IMAGE \
  -u ARENA_SEED_IMAGE \
  BACKUP_MIN_FREE_MB=1 \
  bash infra/scripts/backup.sh "$failure_inventory" >"$work/pg-dump-failure.log" 2>&1; then
  echo "forced pg_dump failure unexpectedly passed" >&2
  exit 1
fi
[[ -z "$(find "$failure_root" -mindepth 1 -maxdepth 1 -print -quit)" ]]
if grep -F 'backup-ci-secret' "$work/pg-dump-failure.log"; then
  echo "failure diagnostics exposed a credential" >&2
  exit 1
fi

printf 'tracked prebuilt backup runtime validated: dump=%s checksum=pass negatives=7 failure_cleanup=pass\n' \
  "$(stat -c %s "$target/postgres.dump")"
