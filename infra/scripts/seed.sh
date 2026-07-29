#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"
parse_common_args "$@"; [[ "$ENVIRONMENT" == staging || "${ALLOW_PRODUCTION_BASELINE_SEED:-false}" == true ]] || die "production seed requires explicit opt-in"
export_runtime_paths
if [[ "$DRY_RUN" == true ]]; then info "seed dry-run validated inventory; no lock or container created"; exit 0; fi
acquire_lock "$SERVER_APP_ROOT/run/seed.lock"
compose --profile seed run --rm arena-seed
