#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
[[ "$ENABLE_UFW" == true ]] || { warn "UFW disabled by inventory"; exit 0; }
run ufw allow "${SERVER_SSH_PORT}/tcp" comment Arena-SSH
run ufw allow 80/tcp comment Arena-HTTP
[[ "$ENABLE_TLS" == true ]] && run ufw allow 443/tcp comment Arena-HTTPS
run ufw default deny incoming; run ufw default allow outgoing
run ufw --force enable; run ufw status verbose
if command -v iptables >/dev/null 2>&1; then
  run iptables -N DOCKER-USER 2>/dev/null || true
  run iptables -C DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null ||
    run iptables -I DOCKER-USER 1 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
  run iptables -C DOCKER-USER -i lo -j ACCEPT 2>/dev/null ||
    run iptables -I DOCKER-USER 2 -i lo -j ACCEPT
  run iptables -C DOCKER-USER -j RETURN 2>/dev/null ||
    run iptables -A DOCKER-USER -j RETURN
fi
