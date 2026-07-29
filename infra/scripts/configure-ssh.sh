#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
[[ $# -ge 2 ]] || die "usage: $0 INVENTORY prepare|finalize [--dry-run]"
inventory="$1"; stage="$2"; shift 2; load_inventory "$inventory"
[[ "${1:-}" != --dry-run ]] || DRY_RUN=true
require_root
forwarding=no; [[ "$SSH_ALLOW_TCP_FORWARDING" == true ]] && forwarding=yes
root_policy=prohibit-password; password_policy=yes
if [[ "$stage" == finalize ]]; then
  marker=/var/lib/arena/operator-key-verified
  [[ -f "$marker" && ! -L "$marker" ]] || die "second-session verification marker missing"
  [[ "$(stat -c '%U:%G:%a' "$marker")" == root:root:600 ]] || die "verification marker ownership or mode invalid"
  grep -q "^user=$SERVER_OPERATOR_USER$" "$marker" || die "verification marker user mismatch"
  grep -q '^method=publickey$' "$marker" || die "verification marker lacks public-key evidence"
  root_policy=no; password_policy=no
elif [[ "$stage" != prepare ]]; then die "stage must be prepare or finalize"; fi
content="PermitRootLogin $root_policy
PasswordAuthentication $password_policy
KbdInteractiveAuthentication no
PubkeyAuthentication yes
ExposeAuthInfo yes
PermitEmptyPasswords no
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding $forwarding
MaxAuthTries 4
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2"
write_managed_file /etc/ssh/sshd_config.d/00-arena-hardening.conf 0644 root "$content"
if [[ -e /etc/ssh/sshd_config.d/99-arena-hardening.conf ]]; then
  run unlink /etc/ssh/sshd_config.d/99-arena-hardening.conf
fi
run sshd -t
run systemctl reload ssh
info "SSH $stage applied without changing configured port"
