#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"
dry_args=()
[[ "$DRY_RUN" == true ]] && dry_args+=(--dry-run)
for action in configure-sysctl install-firewall install-fail2ban; do "$SCRIPT_DIR/$action.sh" "$INVENTORY_FILE" "${dry_args[@]}"; done
