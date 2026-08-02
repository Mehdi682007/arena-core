#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'run as root' >&2; exit 1; }
install -d -o root -g root -m 0750 /etc/arena /var/lib/arena-monitor
for unit in arena-backup.service arena-backup.timer arena-monitor.service arena-monitor.timer; do
  install -o root -g root -m 0644 "$(dirname "$0")/../systemd/$unit" "/etc/systemd/system/$unit"
done
if [[ ! -e /etc/arena/monitoring.env ]]; then
  install -o root -g root -m 0640 "$(dirname "$0")/../inventory/monitoring.env.example" /etc/arena/monitoring.env
fi
systemctl daemon-reload
systemctl enable --now arena-backup.timer arena-monitor.timer
