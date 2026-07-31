#!/usr/bin/env bash
set -Eeuo pipefail

_arena_color=false
[[ -t 2 ]] && _arena_color=true
log() {
  local level="$1"; shift
  printf '%s [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$level" "$*" >&2
}
info() { log INFO "$@"; }
warn() { log WARN "$@"; }
die() { log ERROR "$@"; exit 1; }
