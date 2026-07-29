#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/backup.sh"
parse_common_args "$@"; require_root
if [[ "$DRY_RUN" == true ]]; then
  info "dry-run validates inventory and prints provisioning actions without creating locks or backups"
else
  acquire_lock /var/lock/arena-provision.lock
fi
dry_args=()
[[ "$DRY_RUN" == true ]] && dry_args+=(--dry-run)
bash "$SCRIPT_DIR/host-preflight.sh" "$INVENTORY_FILE" "${dry_args[@]}"
[[ "$DRY_RUN" == true ]] || backup_system_configuration
steps=(install-updates configure-time configure-swap configure-sysctl create-operator-user prepare-directories install-docker install-firewall install-fail2ban install-reverse-proxy)
for step in "${steps[@]}"; do bash "$SCRIPT_DIR/$step.sh" "$INVENTORY_FILE" "${dry_args[@]}"; done
bash "$SCRIPT_DIR/configure-ssh.sh" "$INVENTORY_FILE" prepare "${dry_args[@]}"
[[ "$DRY_RUN" == true ]] || { install -d -m 0755 /var/lib/arena; date -u +'%Y-%m-%dT%H:%M:%SZ' >/var/lib/arena/provisioned; }
info "prepare phase complete; verify operator login, then run configure-ssh.sh INVENTORY finalize"
