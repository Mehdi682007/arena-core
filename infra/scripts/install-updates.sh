#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
run apt-get update
run env DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg jq rsync unzip git chrony ufw fail2ban unattended-upgrades nginx
[[ "$ENABLE_UNATTENDED_UPDATES" == true ]] && run dpkg-reconfigure -f noninteractive unattended-upgrades
if [[ -f /var/run/reboot-required ]]; then warn "host reboot required; not rebooting automatically"; fi
