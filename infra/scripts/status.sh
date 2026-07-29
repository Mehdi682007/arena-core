#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"
parse_common_args "$@"; export_runtime_paths
compose ps --all
systemctl --no-pager --full status docker nginx fail2ban | sed -E 's/(password|token|secret)=([^ ]+)/\1=<redacted>/Ig'
