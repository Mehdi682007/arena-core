#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
if [[ "$DRY_RUN" == true ]]; then
  printf '%s\n' 'DRY-RUN: inspect Docker availability and configure repository, daemon policy, and service if required'
  exit 0
fi
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/ubuntu/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  arch="$(dpkg --print-architecture)"; codename="$(. /etc/os-release; echo "$VERSION_CODENAME")"
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "$arch" "$codename" >/etc/apt/sources.list.d/docker.list
  run apt-get update
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
content='{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"},"live-restore":true}'
write_managed_file /etc/docker/daemon.json 0644 root "$content"
run dockerd --validate --config-file=/etc/docker/daemon.json
run systemctl enable --now docker
[[ "$OPERATOR_DOCKER_GROUP" == true ]] && { warn "docker group is root-equivalent"; run usermod -aG docker "$SERVER_OPERATOR_USER"; }
run docker version; run docker compose version
