#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
[[ "$ENABLE_SWAP" == true ]] || { info "swap disabled by inventory"; exit 0; }
swapon --show=NAME --noheadings | grep -q . && { info "existing swap preserved"; exit 0; }
[[ "$SWAP_SIZE_GB" =~ ^[1-9][0-9]*$ ]] || die "invalid SWAP_SIZE_GB"
[[ ! -e /swapfile ]] || die "unknown /swapfile exists"
run fallocate -l "${SWAP_SIZE_GB}G" /swapfile; run chmod 0600 /swapfile; run mkswap /swapfile; run swapon /swapfile
if ! grep -qE '^/swapfile[[:space:]]' /etc/fstab; then
  if [[ "$DRY_RUN" == true ]]; then printf '%s\n' 'DRY-RUN: append swapfile entry to /etc/fstab'
  else printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
  fi
fi
write_managed_file /etc/sysctl.d/90-arena-swap.conf 0644 root 'vm.swappiness=10'
