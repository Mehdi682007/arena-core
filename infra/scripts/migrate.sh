#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"
parse_common_args "$@"; export_runtime_paths; acquire_lock "$SERVER_APP_ROOT/run/deploy.lock"
compose config --quiet
if [[ "$DRY_RUN" == true ]]; then info "migration dry-run validated Compose configuration; no lock or container created"; exit 0; fi
[[ "$POSTGRES_MODE" == container ]] && compose --profile container-db up -d --wait postgres
compose run --no-deps --rm arena-migrate
