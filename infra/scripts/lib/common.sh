#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
INFRA_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
REPO_ROOT="$(cd -- "$INFRA_DIR/.." && pwd -P)"
# shellcheck source=logging.sh
source "$SCRIPT_DIR/lib/logging.sh"

DRY_RUN=false
ENVIRONMENT_NAME=
INVENTORY_FILE=
LOCK_FDS=()

on_error() { log ERROR "command failed at line $1 (exit $2)"; }
trap 'on_error "$LINENO" "$?"' ERR

run() {
  if [[ "$DRY_RUN" == true ]]; then
    printf 'DRY-RUN:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

require_root() { [[ "$(id -u)" == 0 ]] || die "run this command as root"; }
require_command() { command -v "$1" >/dev/null 2>&1 || die "required command missing: $1"; }
ensure_dir() {
  local path="$1" mode="$2" owner="$3"
  run install -d -m "$mode" -o "$owner" -g "$owner" "$path"
}
write_managed_file() {
  local target="$1" mode="$2" owner="$3" content="$4" tmp
  if [[ "$DRY_RUN" == true ]]; then
    printf 'DRY-RUN: write managed file %q mode=%q owner=%q\n' "$target" "$mode" "$owner"
    return
  fi
  tmp="$(mktemp)"
  printf '%s\n' "$content" >"$tmp"
  if [[ -f "$target" ]] && cmp -s "$tmp" "$target"; then rm -f "$tmp"; return; fi
  run install -D -m "$mode" -o "$owner" -g "$owner" "$tmp" "$target"
  rm -f "$tmp"
}
acquire_lock() {
  local path="$1" fd
  if [[ "$DRY_RUN" == true ]]; then
    printf 'DRY-RUN: acquire lock %q\n' "$path"
    return
  fi
  require_command flock
  mkdir -p "$(dirname "$path")"
  exec {fd}>"$path"
  flock -n "$fd" || die "another automation process holds $path"
  LOCK_FDS+=("$fd")
}
release_locks() {
  local fd
  for fd in "${LOCK_FDS[@]}"; do flock -u "$fd" || true; exec {fd}>&-; done
  LOCK_FDS=()
}
trap release_locks EXIT
