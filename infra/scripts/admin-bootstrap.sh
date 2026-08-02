#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"; source "$SCRIPT_DIR/lib/images.sh"
inventory="${1:?inventory path required}"; shift
load_inventory "$inventory"
email= verify_email=false
while (($#)); do
  case "$1" in
    --email) shift; email="${1:-}" ;;
    --email=*) email="${1#*=}" ;;
    --verify-email) verify_email=true ;;
    --dry-run) die "administrator bootstrap does not support dry-run" ;;
    *) die "usage: admin-bootstrap.sh INVENTORY --email ADDRESS [--verify-email]" ;;
  esac
  shift
done
[[ -n "$email" ]] || die "--email is required"
export_runtime_paths
configure_release_images "$ARENA_RELEASE_DIR" "$RELEASE_VERSION"
validate_seed_compose_contract
acquire_lock "$SERVER_APP_ROOT/run/admin-bootstrap.lock"
args=(dist/admin-bootstrap-cli.js --email "$email")
[[ "$verify_email" == true ]] && args+=(--verify-email)
compose --profile seed run --no-deps --rm --entrypoint node arena-seed "${args[@]}"
