#!/usr/bin/env bash
set -Eeuo pipefail

compose_files() {
  printf '%s\n' -f "$INFRA_DIR/compose/compose.base.yml"

  if [[ "$DEPLOY_MODE" == build-local ]]; then
    printf '%s\n' -f "$INFRA_DIR/compose/compose.build-local.yml"
  fi

  printf '%s\n' -f "$INFRA_DIR/compose/compose.automation.${ENVIRONMENT}.yml"
}

compose() {
  local -a files profile

  if [[ -f "${ARENA_ENV_FILE:-}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ARENA_ENV_FILE"
    set +a
  fi

  mapfile -t files < <(compose_files)

  profile=()
  if [[ "${POSTGRES_MODE:-container}" == container ]]; then
    profile=(--profile container-db)
  fi

  export \
    ARENA_ENV_FILE \
    ARENA_SECRETS_DIR \
    POSTGRES_DB \
    POSTGRES_USER \
    POSTGRES_PASSWORD \
    RELEASE_VERSION \
    BUILD_SHA \
    ARENA_MIGRATE_IMAGE \
    ARENA_API_IMAGE \
    ARENA_WORKER_IMAGE \
    ARENA_WEB_IMAGE \
    ARENA_SEED_IMAGE

  (
    cd "$REPO_ROOT"

    docker compose \
      --project-directory "$REPO_ROOT" \
      "${files[@]}" \
      "${profile[@]}" \
      "$@"
  )
}

validate_seed_compose_contract() {
  : "${ARENA_SEED_IMAGE:?ARENA_SEED_IMAGE required}"

  compose --profile seed config --format json |
    python3 "$SCRIPT_DIR/validate-seed-compose.py" "$ARENA_SEED_IMAGE"
}

export_runtime_paths() {
  local deploy_release_version deploy_build_sha

  deploy_release_version="${RELEASE_VERSION:?RELEASE_VERSION required}"
  deploy_build_sha="${BUILD_SHA:-uncommitted}"

  export ARENA_RELEASE_DIR="$SERVER_APP_ROOT/releases/$deploy_release_version"
  export ARENA_ENV_FILE="$SERVER_APP_ROOT/shared/env/runtime.env"
  export ARENA_SECRETS_DIR="$SERVER_APP_ROOT/shared/secrets"
  export IMAGE_TAG="$deploy_release_version"
  export ARENA_IMAGE_MANIFEST="$ARENA_RELEASE_DIR/release/deployment-images.json"

  if [[ -f "$ARENA_ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ARENA_ENV_FILE"
    set +a
  fi

  export RELEASE_VERSION="$deploy_release_version"
  export BUILD_SHA="$deploy_build_sha"

  export ARENA_ENV_FILE
  export ARENA_SECRETS_DIR
  export POSTGRES_DB
  export POSTGRES_USER

  if [[ "$DEPLOY_MODE" == build-local ]]; then
    export ARENA_MIGRATE_IMAGE="arena-migrate:$IMAGE_TAG"
    export ARENA_API_IMAGE="arena-api:$IMAGE_TAG"
    export ARENA_WORKER_IMAGE="arena-worker:$IMAGE_TAG"
    export ARENA_WEB_IMAGE="arena-web:$IMAGE_TAG"
    export ARENA_SEED_IMAGE="arena-seed:$IMAGE_TAG"
  fi
}

export_runtime_environment() {
  export POSTGRES_DB="${POSTGRES_DB:-}"
  export POSTGRES_USER="${POSTGRES_USER:-}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

  export ARENA_ENV_FILE="${ARENA_ENV_FILE:-$SERVER_APP_ROOT/shared/env/runtime.env}"
  export ARENA_SECRETS_DIR="${ARENA_SECRETS_DIR:-$SERVER_APP_ROOT/shared/secrets}"

  : "${POSTGRES_DB:?POSTGRES_DB required}"
  : "${POSTGRES_USER:?POSTGRES_USER required}"
  : "${ARENA_ENV_FILE:?ARENA_ENV_FILE required}"
  : "${ARENA_SECRETS_DIR:?ARENA_SECRETS_DIR required}"
}