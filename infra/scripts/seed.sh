#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"; source "$SCRIPT_DIR/lib/images.sh"
parse_common_args "$@"; [[ "$ENVIRONMENT" == staging || "${ALLOW_PRODUCTION_BASELINE_SEED:-false}" == true ]] || die "production seed requires explicit opt-in"
export_runtime_paths
if [[ "$DRY_RUN" == true ]]; then info "seed dry-run validated inventory; no lock or container created"; exit 0; fi
configure_release_images "$ARENA_RELEASE_DIR" "$RELEASE_VERSION"
validate_seed_compose_contract
acquire_lock "$SERVER_APP_ROOT/run/seed.lock"
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
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
