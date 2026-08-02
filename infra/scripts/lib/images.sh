#!/usr/bin/env bash
set -Eeuo pipefail

validate_release_archive() {
  : "${RELEASE_ARCHIVE:?RELEASE_ARCHIVE required}"
  : "${RELEASE_ARCHIVE_SHA256:?RELEASE_ARCHIVE_SHA256 required}"
  [[ -f "$RELEASE_ARCHIVE" && ! -L "$RELEASE_ARCHIVE" ]] || die "release archive missing or unsafe"
  [[ "$RELEASE_ARCHIVE_SHA256" =~ ^[0-9a-fA-F]{64}$ ]] || die "invalid RELEASE_ARCHIVE_SHA256"
  python3 "$SCRIPT_DIR/validate-release-archive.py" \
    "$RELEASE_ARCHIVE" "$RELEASE_VERSION" "$BUILD_SHA" "$RELEASE_ARCHIVE_SHA256" >/dev/null ||
    die "release archive identity validation failed"
}

load_release_metadata() {
  local release_dir="$1"
  local expected_release_version="${2:-}"
  local manifest metadata manifest_release_version manifest_build_sha

  manifest="$release_dir/release/manifest.json"

  require_command python3

  [[ -f "$manifest" && ! -L "$manifest" ]] ||
    die "release manifest missing or unsafe: $manifest"

  metadata="$(
    python3 - "$manifest" <<'PY'
import json
import sys

path = sys.argv[1]

try:
    with open(path, encoding="utf-8") as handle:
        document = json.load(handle)
except (OSError, json.JSONDecodeError):
    raise SystemExit("invalid release manifest")

release_version = document.get("releaseVersion")
build_sha = document.get("buildSha")

if not isinstance(release_version, str) or not release_version.strip():
    raise SystemExit("releaseVersion missing from release manifest")

if not isinstance(build_sha, str) or not build_sha.strip():
    raise SystemExit("buildSha missing from release manifest")

print(f"{release_version}\t{build_sha}")
PY
  )" || die "failed to load release metadata"

  IFS=$'\t' read -r manifest_release_version manifest_build_sha <<<"$metadata"

  [[ -n "$manifest_release_version" ]] ||
    die "releaseVersion missing from release manifest"

  [[ -n "$manifest_build_sha" ]] ||
    die "buildSha missing from release manifest"

  if [[ -n "$expected_release_version" &&
        "$manifest_release_version" != "$expected_release_version" ]]; then
    die "release manifest version mismatch: expected $expected_release_version"
  fi

  export RELEASE_VERSION="$manifest_release_version"
  export BUILD_SHA="$manifest_build_sha"
}

configure_release_images() {
  local release_dir="$1"
  local expected_release_version="${2:-}"

  load_release_metadata "$release_dir" "$expected_release_version"

  export ARENA_RELEASE_DIR="$release_dir"
  export ARENA_IMAGE_MANIFEST="$release_dir/release/deployment-images.json"
  export IMAGE_TAG="$RELEASE_VERSION"

  if [[ "$DEPLOY_MODE" == prebuilt ]]; then
    unset \
      ARENA_MIGRATE_IMAGE \
      ARENA_API_IMAGE \
      ARENA_WORKER_IMAGE \
      ARENA_WEB_IMAGE \
      ARENA_SEED_IMAGE

    load_prebuilt_images "$ARENA_IMAGE_MANIFEST"
  else
    export ARENA_MIGRATE_IMAGE="arena-migrate:$IMAGE_TAG"
    export ARENA_API_IMAGE="arena-api:$IMAGE_TAG"
    export ARENA_WORKER_IMAGE="arena-worker:$IMAGE_TAG"
    export ARENA_WEB_IMAGE="arena-web:$IMAGE_TAG"
    export ARENA_SEED_IMAGE="arena-seed:$IMAGE_TAG"
  fi
}

load_prebuilt_images() {
  local manifest="$1"
  local service reference

  require_command python3

  [[ -f "$manifest" && ! -L "$manifest" ]] ||
    die "prebuilt image manifest missing or unsafe"

  while IFS=$'\t' read -r service reference; do
    case "$service" in
      migrate)
        export ARENA_MIGRATE_IMAGE="$reference"
        ;;
      api)
        export ARENA_API_IMAGE="$reference"
        ;;
      worker)
        export ARENA_WORKER_IMAGE="$reference"
        ;;
      web)
        export ARENA_WEB_IMAGE="$reference"
        ;;
      seed)
        export ARENA_SEED_IMAGE="$reference"
        ;;
      *)
        die "unexpected image service: $service"
        ;;
    esac
  done < <(
    python3 "$SCRIPT_DIR/validate-image-manifest.py" \
      "$manifest" \
      "$RELEASE_VERSION" \
      "${BUILD_SHA:?BUILD_SHA required}"
  )

  : "${ARENA_MIGRATE_IMAGE:?migrate image missing}"
  : "${ARENA_API_IMAGE:?api image missing}"
  : "${ARENA_WORKER_IMAGE:?worker image missing}"
  : "${ARENA_WEB_IMAGE:?web image missing}"
  : "${ARENA_SEED_IMAGE:?seed image missing}"
}

validate_registry_credentials() {
  local mode

  [[ -n "${REGISTRY_USERNAME:-}" ]] || return 0

  [[ -f "$REGISTRY_TOKEN_FILE" && ! -L "$REGISTRY_TOKEN_FILE" ]] ||
    die "registry token file missing or unsafe"

  mode="$(stat -c '%a' "$REGISTRY_TOKEN_FILE")"

  [[ "$mode" == 600 || "$mode" == 400 ]] ||
    die "unsafe registry token permissions"
}

registry_host() {
  printf '%s\n' "${ARENA_API_IMAGE%%/*}"
}

pull_and_verify_prebuilt_images() {
  local reference tagged name digest expected_repo_digest
  local repo_digests revision version

  for reference in \
    "$ARENA_MIGRATE_IMAGE" "$ARENA_API_IMAGE" "$ARENA_WORKER_IMAGE" "$ARENA_WEB_IMAGE" \
    "$ARENA_SEED_IMAGE"; do

    [[ "$reference" == *@sha256:* && "$reference" != *":latest@"* ]] ||
      die "prebuilt image reference is not immutable"

    docker pull "$reference" || die "failed to pull prebuilt image"

    tagged="${reference%@*}"
    name="${tagged%:*}"
    digest="${reference##*@}"
    expected_repo_digest="$name@$digest"

    repo_digests="$(
      docker image inspect \
        --format '{{json .RepoDigests}}' \
        "$reference"
    )" || die "pulled image inspection failed"

    if ! python3 - "$repo_digests" "$expected_repo_digest" <<'PY'
import json
import sys

if sys.argv[2] not in json.loads(sys.argv[1]):
    raise SystemExit(1)
PY
    then
      die "pulled image RepoDigest mismatch"
    fi

    revision="$(
      docker image inspect \
        --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
        "$reference"
    )" || die "pulled image revision label inspection failed"

    version="$(
      docker image inspect \
        --format '{{index .Config.Labels "org.opencontainers.image.version"}}' \
        "$reference"
    )" || die "pulled image version label inspection failed"

    [[ "$revision" == "$BUILD_SHA" ]] ||
      die "pulled image revision label mismatch"

    [[ "$version" == "$RELEASE_VERSION" ]] ||
      die "pulled image version label mismatch"
  done
}
