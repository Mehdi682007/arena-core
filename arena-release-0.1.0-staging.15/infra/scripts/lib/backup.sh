#!/usr/bin/env bash
set -Eeuo pipefail

backup_system_configuration() {
  local root timestamp destination manifest path
  root="${SYSTEM_BACKUP_ROOT:-/root/arena-provisioning-backup}"
  timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
  destination="$root/$timestamp"
  install -d -m 0700 "$destination"
  manifest="$destination/SHA256SUMS"
  : >"$manifest"
  for path in /etc/ssh/sshd_config /etc/ssh/sshd_config.d /etc/sysctl.conf /etc/sysctl.d /etc/fstab /etc/ufw /etc/fail2ban /etc/nginx /etc/docker /etc/systemd/system; do
    [[ -e "$path" ]] || continue
    cp -a --parents "$path" "$destination"
  done
  find "$destination/etc" -type f -exec sha256sum {} + >"$manifest" 2>/dev/null || true
  chmod 0600 "$manifest"
  info "system configuration backup created at $destination"
}
