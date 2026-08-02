#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
template="$INFRA_DIR/nginx/staging-ip.conf.template"
[[ -n "${APP_DOMAIN:-}" ]] && template="$INFRA_DIR/nginx/domain.conf.template"
content="$(sed -e "s/{{APP_DOMAIN}}/${APP_DOMAIN:-_}/g" -e "s/{{ADMIN_DOMAIN}}/${ADMIN_DOMAIN:-_}/g" -e "s/{{WEB_PORT}}/3000/g" -e "s/{{API_PORT}}/3001/g" "$template")"
write_managed_file /etc/nginx/sites-available/arena.conf 0644 root "$content"
if [[ -L /etc/nginx/sites-enabled/default ]]; then run unlink /etc/nginx/sites-enabled/default; fi
run ln -sfn /etc/nginx/sites-available/arena.conf /etc/nginx/sites-enabled/arena.conf
run nginx -t; run systemctl enable --now nginx; run systemctl reload nginx
