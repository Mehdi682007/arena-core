#!/usr/bin/env bash
set -Eeuo pipefail
compose_files() {
  printf '%s\n' -f "$INFRA_DIR/compose/compose.base.yml"
  [[ "$DEPLOY_MODE" == build-local ]] &&
    printf '%s\n' -f "$INFRA_DIR/compose/compose.build-local.yml"
  printf '%s\n' -f "$INFRA_DIR/compose/compose.automation.${ENVIRONMENT}.yml"
}
compose() {
  local -a files profile
  mapfile -t files < <(compose_files)
  profile=()
  [[ "${POSTGRES_MODE:-container}" == container ]] && profile=(--profile container-db)
  docker compose --project-directory "$REPO_ROOT" "${files[@]}" "${profile[@]}" "$@"
}
validate_seed_compose_contract() {
  : "${ARENA_SEED_IMAGE:?ARENA_SEED_IMAGE required}"
  compose --profile seed config --format json |
    python3 "$SCRIPT_DIR/validate-seed-compose.py" "$ARENA_SEED_IMAGE"
}
export_runtime_paths() {
  export ARENA_RELEASE_DIR="$SERVER_APP_ROOT/releases/${RELEASE_VERSION:?RELEASE_VERSION required}"
  export ARENA_ENV_FILE="$SERVER_APP_ROOT/shared/env/runtime.env"
  export ARENA_SECRETS_DIR="$SERVER_APP_ROOT/shared/secrets"
  export IMAGE_TAG="$RELEASE_VERSION"
  export BUILD_SHA="${BUILD_SHA:-uncommitted}"
  export ARENA_IMAGE_MANIFEST="$ARENA_RELEASE_DIR/release/deployment-images.json"
  if [[ "$DEPLOY_MODE" == build-local ]]; then
    export ARENA_MIGRATE_IMAGE="arena-migrate:$IMAGE_TAG"
    export ARENA_API_IMAGE="arena-api:$IMAGE_TAG"
    export ARENA_WORKER_IMAGE="arena-worker:$IMAGE_TAG"
    export ARENA_WEB_IMAGE="arena-web:$IMAGE_TAG"
    export ARENA_SEED_IMAGE="arena-seed:$IMAGE_TAG"
  fi
}
