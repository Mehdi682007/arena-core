#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"
source "$SCRIPT_DIR/lib/validation.sh"
source "$SCRIPT_DIR/lib/compose.sh"
source "$SCRIPT_DIR/lib/images.sh"
parse_common_args "$@"
export_runtime_paths
validate_release_archive
if [[ "$DRY_RUN" == true ]]; then
  info "release installation dry-run passed; archive identity and safety validated without mutation"
  exit 0
fi
acquire_lock "$SERVER_APP_ROOT/run/deploy.lock"
target_release="$ARENA_RELEASE_DIR"
[[ ! -e "$target_release" ]] || die "release directory already exists; immutable release will not be overwritten"
incoming="$SERVER_APP_ROOT/releases/.${RELEASE_VERSION}.incoming.$$"
cleanup_incoming() { [[ ! -e "$incoming" ]] || rm -rf -- "$incoming"; }
trap cleanup_incoming ERR INT TERM
mkdir -m 0750 "$incoming"
tar -xzf "$RELEASE_ARCHIVE" -C "$incoming" --no-same-owner --no-same-permissions
configure_release_images "$incoming" "$RELEASE_VERSION"
[[ "$BUILD_SHA" == "${INVENTORY_BUILD_SHA:?inventory BUILD_SHA required}" ]] || die "installed release build SHA mismatch"
chmod -R go-w "$incoming"
mv "$incoming" "$target_release"
trap - ERR INT TERM
info "immutable release installed: $target_release"
