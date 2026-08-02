#!/usr/bin/env bash
set -Eeuo pipefail
state_dir=/var/lib/arena-monitor; mkdir -p "$state_dir"; result="$state_dir/last-result"; failures=()
redact() { sed -E 's#(://)[^/@[:space:]]+@#\1[REDACTED]@#g; s/(token|password|secret)=[^[:space:]]+/\1=[REDACTED]/gi'; }
check() { local name=$1; shift; if ! "$@" >/dev/null 2>&1; then failures+=("$name"); fi; }
check "public-api" curl --fail --silent --show-error --max-time 10 "${PUBLIC_ORIGIN}/api/v1/health/ready"
check "public-web" curl --fail --silent --show-error --max-time 10 "${PUBLIC_ORIGIN}/"
[[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${PUBLIC_ORIGIN}/admin")" == 404 ]] || failures+=("public-admin-concealment")
for service in arena-api arena-web arena-worker; do check "container:$service" docker inspect "$service"; done
check "postgres" pg_isready --timeout=5
check "nginx" nginx -t
check "current-release" test -L /opt/arena/current
disk_used=$(df -P /opt/arena | awk 'NR==2 {gsub("%", "", $5); print $5}')
inode_used=$(df -Pi /opt/arena | awk 'NR==2 {gsub("%", "", $5); print $5}')
(( disk_used < ${DISK_CRITICAL_PERCENT:-90} )) || failures+=("disk-critical")
(( inode_used < ${INODE_CRITICAL_PERCENT:-90} )) || failures+=("inode-critical")
latest=$(find /opt/arena/backups -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)
[[ -n "$latest" && -f "$latest/SHA256SUMS" ]] || failures+=("backup-missing")
status=healthy; ((${#failures[@]} == 0)) || status=unhealthy
printf 'status=%s\ntimestamp=%s\nchecks_failed=%s\n' "$status" "$(date -u +%FT%TZ)" "${failures[*]:-none}" >"$result"
chmod 0640 "$result"
previous=$(cat "$state_dir/alert-state" 2>/dev/null || true)
if [[ "$status" != "$previous" && "${TELEGRAM_ALERTS_ENABLED:-false}" == true ]]; then
  token=$(<"${TELEGRAM_BOT_TOKEN_FILE}"); chat=$(<"${TELEGRAM_CHAT_ID_FILE}")
  message="Arena monitor: $status; ${failures[*]:-recovered}"
  curl --fail --silent --show-error --max-time 10 --data-urlencode "chat_id=$chat" --data-urlencode "text=${message:0:1000}" "https://api.telegram.org/bot${token}/sendMessage" >/dev/null 2> >(redact >&2) || true
fi
printf '%s' "$status" >"$state_dir/alert-state"
[[ "$status" == healthy ]]
