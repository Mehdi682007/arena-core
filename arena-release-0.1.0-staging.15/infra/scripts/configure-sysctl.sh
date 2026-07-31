#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
content="# Conservative Arena host baseline; Docker-compatible.
fs.file-max=1048576
net.core.somaxconn=4096
net.ipv4.tcp_keepalive_time=600
net.ipv4.tcp_syncookies=1
kernel.dmesg_restrict=1
fs.suid_dumpable=0"
write_managed_file /etc/sysctl.d/99-arena.conf 0644 root "$content"
run sysctl --system
