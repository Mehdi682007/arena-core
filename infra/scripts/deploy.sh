#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/validation.sh"
source "$SCRIPT_DIR/lib/compose.sh"
source "$SCRIPT_DIR/lib/images.sh"

[[ $# -ge 1 ]] || die "inventory required"

inventory="$1"
shift

load_inventory "$inventory"

while (($#)); do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
  shift
done

export_runtime_paths
export_runtime_environment

if [[ -n "${RELEASE_ARCHIVE:-}" ]]; then
  [[ -f "$RELEASE_ARCHIVE" ]] || die "release archive missing: $RELEASE_ARCHIVE"

  mkdir -p "$ARENA_RELEASE_DIR"

  tar -xzf "$RELEASE_ARCHIVE" -C "$ARENA_RELEASE_DIR"

  info "release archive extracted: $RELEASE_ARCHIVE"
fi

[[ -f "$ARENA_RELEASE_DIR/release/manifest.json" ]] ||
  die "release manifest missing"

configure_release_images "$ARENA_RELEASE_DIR" "$RELEASE_VERSION"

validate_seed_compose_contract

[[ "$DEPLOY_MODE" == prebuilt ]] &&
  validate_registry_credentials

compose config --quiet

if [[ "$DRY_RUN" == true ]]; then
  compose config >/dev/null
  info "deployment dry-run passed without locks, backups, directories, or runtime writes"
  exit 0
fi

acquire_lock "$SERVER_APP_ROOT/run/deploy.lock"

registry_config=

cleanup_registry_config() {
  [[ -n "$registry_config" ]] && rm -rf "$registry_config"
}

trap 'cleanup_registry_config; release_locks' EXIT


previous_release=

[[ -L "$SERVER_APP_ROOT/current" ]] &&
  previous_release="$(readlink -f "$SERVER_APP_ROOT/current")"


activate_release() {
  local release_dir="$1"
  local release_version="$2"

  configure_release_images "$release_dir" "$release_version"
  export_runtime_environment

  compose up -d arena-api arena-worker arena-web
}


record_deployment() {
  local release="$1"
  local state="$2"
  local previous="$3"

  umask 077

  printf '{"release":"%s","state":"%s","previousRelease":"%s","timestamp":"%s","deployMode":"%s","imageManifestSha256":"%s","images":{"migrate":"%s","api":"%s","worker":"%s","web":"%s","seed":"%s"}}\n' \
    "$release" \
    "$state" \
    "$previous" \
    "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    "$DEPLOY_MODE" \
    "$(if [[ "$DEPLOY_MODE" == prebuilt ]]; then sha256sum "$ARENA_IMAGE_MANIFEST" | cut -d' ' -f1; else printf 'build-local'; fi)" \
    "$ARENA_MIGRATE_IMAGE" \
    "$ARENA_API_IMAGE" \
    "$ARENA_WORKER_IMAGE" \
    "$ARENA_WEB_IMAGE" \
    "$ARENA_SEED_IMAGE" \
    >"$SERVER_APP_ROOT/shared/deployment.json"
}


if [[ "$DEPLOY_MODE" == build-local ]]; then

  for service in arena-migrate arena-api arena-worker arena-web; do

    build_started_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    build_started_epoch="$(date +%s)"

    info "build start service=$service timestamp=$build_started_at"

    if compose build "$service"; then
      build_rc=0
    else
      build_rc=$?
    fi

    build_finished_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

    build_duration="$(( $(date +%s) - build_started_epoch ))"

    info "build finish service=$service timestamp=$build_finished_at exit_code=$build_rc duration_seconds=$build_duration"

    ((build_rc == 0)) || exit "$build_rc"

  done

else

  if [[ -n "${REGISTRY_USERNAME:-}" ]]; then

    registry_config="$(mktemp -d)"

    chmod 0700 "$registry_config"

    export DOCKER_CONFIG="$registry_config"

    docker login "$(registry_host)" \
      --username "$REGISTRY_USERNAME" \
      --password-stdin \
      <"$REGISTRY_TOKEN_FILE" >/dev/null
  fi

  pull_and_verify_prebuilt_images

fi


[[ "$POSTGRES_MODE" == container ]] &&
  compose --profile container-db up -d --wait postgres


if [[ "${DEPLOY_BACKUP_ENABLED:-true}" == true ]] &&
{
  [[ "$POSTGRES_MODE" == external ]] ||
  compose --profile container-db ps --status running postgres >/dev/null 2>&1;
}; then

  "$SCRIPT_DIR/backup.sh" "$inventory"

elif [[ "$ENVIRONMENT" == production ]]; then

  die "pre-migration production backup could not be created"

else

  warn "pre-migration backup skipped because staging database is not yet running"

fi


compose run --no-deps --rm arena-migrate


activate_release "$ARENA_RELEASE_DIR" "$RELEASE_VERSION"


if ! "$SCRIPT_DIR/verify.sh" "$inventory"; then

  failed_version="$RELEASE_VERSION"
  failed_release="$ARENA_RELEASE_DIR"

  if [[ -n "$previous_release" &&
        -f "$previous_release/release/manifest.json" ]]; then

    previous_version="$(basename "$previous_release")"

    warn "new application failed verification; restoring $previous_version"

    activate_release "$previous_release" "$previous_version"

    if ARENA_VERIFY_RELEASE_VERSION="$previous_version" \
      "$SCRIPT_DIR/verify.sh" "$inventory"; then

      ln -sfn "$previous_release" "$SERVER_APP_ROOT/current"

      record_deployment \
        "$previous_version" \
        rollback-after-failed-deploy \
        "$failed_version"

      die "deployment failed; previous release restored and verified"

    fi

    warn "previous release failed verification; restoring failed deployment for diagnosis"

    activate_release "$failed_release" "$failed_version"

    record_deployment \
      "$failed_version" \
      rollback-failed \
      "$previous_version"

    die "deployment and automatic rollback verification both failed"

  fi


  compose stop arena-api arena-worker arena-web

  die "new application failed verification and no previous release was available"

fi


ln -sfn "$ARENA_RELEASE_DIR" "$SERVER_APP_ROOT/current"
record_deployment "$RELEASE_VERSION" active "${previous_release##*/}"
