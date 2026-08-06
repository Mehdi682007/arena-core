#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/lib/common.sh"
source "$SCRIPT_DIR/lib/validation.sh"
source "$SCRIPT_DIR/lib/compose.sh"
source "$SCRIPT_DIR/lib/images.sh"

parse_common_args "$@"

[[ "$ENVIRONMENT" == staging || "$ALLOW_PRODUCTION_BASELINE_SEED" == true ]] ||
  die "production seed requires explicit opt-in"

ARENA_LIFECYCLE_LOCK_HELD="${ARENA_LIFECYCLE_LOCK_HELD:-false}"

valid_bool "$ARENA_LIFECYCLE_LOCK_HELD" ||
  die "ARENA_LIFECYCLE_LOCK_HELD must be true or false"

export_runtime_paths
configure_release_images "$ARENA_RELEASE_DIR" "$RELEASE_VERSION"
validate_seed_compose_contract

if [[ "$DRY_RUN" == true ]]; then
  info "seed dry-run validated inventory, release image, and Compose contract; no lock or container created"
  exit 0
fi

log=

cleanup() {
  [[ -z "$log" ]] || rm -f "$log"
  release_locks
}

trap cleanup EXIT

if [[ "$ARENA_LIFECYCLE_LOCK_HELD" != true ]]; then
  acquire_lock "$SERVER_APP_ROOT/run/deploy.lock"
fi

acquire_lock "$SERVER_APP_ROOT/run/seed.lock"

log="$(mktemp)"

if compose --profile seed run --rm arena-seed >"$log" 2>&1; then
  cat "$log"
  info "seed completed"
else
  rc=$?
  warn "seed failed with exit code $rc; bounded redacted diagnostics follow"

  sed -E \
    -e 's#(postgres(ql)?://)[^/@[:space:]]+@#\1[REDACTED]@#gI' \
    -e 's#(authorization:[[:space:]]*(bearer|basic))[[:space:]]+[^[:space:]]+#\1 [REDACTED]#gI' \
    -e 's#((password|secret|token|cookie|dsn)[=:])[[:space:]]*[^[:space:]]+#\1[REDACTED]#gI' \
    "$log" | tail -c 16384 >&2

  exit "$rc"
fi
