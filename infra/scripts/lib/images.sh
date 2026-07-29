#!/usr/bin/env bash
set -Eeuo pipefail

configure_release_images() {
  local release_dir="$1" release_version="$2"
  export ARENA_RELEASE_DIR="$release_dir"
  export ARENA_IMAGE_MANIFEST="$release_dir/release/deployment-images.json"
  export IMAGE_TAG="$release_version"
  export RELEASE_VERSION="$release_version"
  if [[ "$DEPLOY_MODE" == prebuilt ]]; then
    unset ARENA_MIGRATE_IMAGE ARENA_API_IMAGE ARENA_WORKER_IMAGE ARENA_WEB_IMAGE
    load_prebuilt_images "$ARENA_IMAGE_MANIFEST"
  else
    export ARENA_MIGRATE_IMAGE="arena-migrate:$release_version"
    export ARENA_API_IMAGE="arena-api:$release_version"
    export ARENA_WORKER_IMAGE="arena-worker:$release_version"
    export ARENA_WEB_IMAGE="arena-web:$release_version"
    export ARENA_SEED_IMAGE="arena-seed:$release_version"
  fi
}

load_prebuilt_images() {
  local manifest="$1" service reference
  require_command python3
  [[ -f "$manifest" && ! -L "$manifest" ]] || die "prebuilt image manifest missing or unsafe"
  while IFS=$'\t' read -r service reference; do
    case "$service" in
      migrate) export ARENA_MIGRATE_IMAGE="$reference" ;;
      api) export ARENA_API_IMAGE="$reference" ;;
      worker) export ARENA_WORKER_IMAGE="$reference" ;;
      web) export ARENA_WEB_IMAGE="$reference" ;;
      *) die "unexpected image service: $service" ;;
    esac
  done < <(python3 "$SCRIPT_DIR/validate-image-manifest.py" "$manifest" "$RELEASE_VERSION")
  : "${ARENA_MIGRATE_IMAGE:?migrate image missing}"
  : "${ARENA_API_IMAGE:?api image missing}"
  : "${ARENA_WORKER_IMAGE:?worker image missing}"
  : "${ARENA_WEB_IMAGE:?web image missing}"
}

validate_registry_credentials() {
  local mode
  [[ -n "${REGISTRY_USERNAME:-}" ]] || return 0
  [[ -f "$REGISTRY_TOKEN_FILE" && ! -L "$REGISTRY_TOKEN_FILE" ]] ||
    die "registry token file missing or unsafe"
  mode="$(stat -c '%a' "$REGISTRY_TOKEN_FILE")"
  [[ "$mode" == 600 || "$mode" == 400 ]] || die "unsafe registry token permissions"
}

registry_host() {
  printf '%s\n' "${ARENA_API_IMAGE%%/*}"
}

pull_and_verify_prebuilt_images() {
  local reference
  for reference in \
    "$ARENA_MIGRATE_IMAGE" "$ARENA_API_IMAGE" "$ARENA_WORKER_IMAGE" "$ARENA_WEB_IMAGE"; do
    docker pull "$reference" || die "failed to pull prebuilt image"
    docker image inspect "$reference" >/dev/null || die "pulled image verification failed"
  done
}
