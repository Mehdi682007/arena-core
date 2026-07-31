#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
[[ "$ENABLE_FAIL2BAN" == true ]] || { warn "Fail2ban disabled by inventory"; exit 0; }
content="[sshd]
enabled = true
backend = systemd
port = $SERVER_SSH_PORT
maxretry = 5
findtime = 10m
bantime = 1h"
write_managed_file /etc/fail2ban/jail.d/arena-sshd.local 0644 root "$content"
run fail2ban-client -t; run systemctl enable --now fail2ban
