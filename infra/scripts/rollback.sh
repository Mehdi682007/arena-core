#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"; source "$SCRIPT_DIR/lib/images.sh"
[[ $# -eq 2 ]] || die "usage: $0 INVENTORY RELEASE_VERSION"
load_inventory "$1"; target="$SERVER_APP_ROOT/releases/$2"
[[ "${ROLLBACK_CONFIRM:-}" == "$2" ]] || die "set ROLLBACK_CONFIRM to the exact release version"
[[ -f "$target/release/manifest.json" ]] || die "rollback target invalid"
acquire_lock "$SERVER_APP_ROOT/run/deploy.lock"
[[ -L "$SERVER_APP_ROOT/current" ]] || die "current release symlink missing"
current="$(readlink -f "$SERVER_APP_ROOT/current")"; current_version="${current##*/}"
RELEASE_VERSION="$2"
export_runtime_paths
configure_release_images "$target" "$2"
compose up -d arena-api arena-worker arena-web
if ARENA_VERIFY_RELEASE_VERSION="$2" "$SCRIPT_DIR/verify.sh" "$1"; then
  ln -sfn "$target" "$SERVER_APP_ROOT/current"
  umask 077
  printf '{"release":"%s","state":"manual-rollback","previousRelease":"%s","timestamp":"%s"}\n' \
    "$2" "$current_version" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    >"$SERVER_APP_ROOT/shared/deployment.json"
  warn "application rollback verified; database migrations were not reversed"
  exit 0
fi
warn "rollback target failed verification; restoring $current_version"
configure_release_images "$current" "$current_version"
compose up -d arena-api arena-worker arena-web
ARENA_VERIFY_RELEASE_VERSION="$current_version" "$SCRIPT_DIR/verify.sh" "$1" ||
  die "rollback failed and previous release could not be verified"
die "rollback target failed; previous release restored and verified"
