#!/usr/bin/env bash
set -Eeuo pipefail

container_state_is_acceptable() {
  local service="$1" state="$2" health="$3" restarts="$4" threshold="$5"
  [[ "$state" == running ]] || return 1
  [[ "$restarts" =~ ^[0-9]+$ ]] || return 1
  ((restarts <= threshold)) || return 1
  if [[ "$service" != arena-worker ]]; then
    [[ "$health" == healthy || "$health" == none ]] || return 1
  fi
}
