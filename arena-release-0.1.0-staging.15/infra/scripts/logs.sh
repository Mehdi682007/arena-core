#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"
[[ $# -ge 1 ]] || die "inventory required"; inventory="$1"; shift; load_inventory "$inventory"; export_runtime_paths
service=; follow=false; lines=200
while (($#)); do case "$1" in --follow) follow=true;; --lines) shift; lines="${1:?lines required}";; *) service="$1";; esac; shift; done
[[ "$lines" =~ ^[1-9][0-9]{0,3}$ ]] || die "invalid line limit"
args=(logs --tail "$lines"); [[ "$follow" == true ]] && args+=(-f); [[ -n "$service" ]] && args+=("$service")
compose "${args[@]}" | sed -E 's/(password|token|secret|authorization)([=:][^ ]+)/\1=<redacted>/Ig'
