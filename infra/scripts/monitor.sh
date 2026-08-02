#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"
source "$SCRIPT_DIR/lib/validation.sh"
source "$SCRIPT_DIR/lib/compose.sh"
source "$SCRIPT_DIR/lib/images.sh"
source "$SCRIPT_DIR/lib/monitoring.sh"

: "${ARENA_INVENTORY_FILE:?ARENA_INVENTORY_FILE required}"
load_inventory "$ARENA_INVENTORY_FILE"
export_runtime_paths
configure_release_images "$ARENA_RELEASE_DIR" "$RELEASE_VERSION"

state_dir=/var/lib/arena-monitor
install -d -o root -g root -m 0750 "$state_dir"
result="$state_dir/last-result"
failures=()
timeout_seconds="${MONITOR_COMMAND_TIMEOUT_SECONDS:-10}"

redact() {
  sed -E \
    -e 's#(postgres(ql)?|https?)://[^/@[:space:]]+@#\1://[REDACTED]@#gi' \
    -e 's#(token|password|secret|credential|authorization)([=:][^[:space:]]+)#\1=[REDACTED]#gi' \
    -e 's#bot[0-9]+:[A-Za-z0-9_-]+#bot[REDACTED]#g'
}
bounded() { timeout --signal=TERM "${timeout_seconds}s" "$@"; }
check() { local name=$1; shift; bounded "$@" >/dev/null 2>&1 || failures+=("$name"); }
bounded_compose() {
  local -a files profile
  mapfile -t files < <(compose_files)
  profile=(); [[ "$POSTGRES_MODE" == container ]] && profile=(--profile container-db)
  bounded docker compose --project-directory "$REPO_ROOT" "${files[@]}" "${profile[@]}" "$@"
}
validate_dump() {
  local dump=$1
  if [[ "$POSTGRES_MODE" == container ]]; then
    bounded_compose exec -T postgres pg_restore -l <"$dump" >/dev/null
  else
    bounded docker run --rm -i postgres:17.10-alpine3.23 pg_restore -l <"$dump" >/dev/null
  fi
}

check public-api curl --fail --silent --show-error --max-time "$timeout_seconds" "${PUBLIC_ORIGIN}/api/v1/health/ready"
check public-web curl --fail --silent --show-error --max-time "$timeout_seconds" "${PUBLIC_ORIGIN}/"
[[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$timeout_seconds" "${PUBLIC_ORIGIN}/admin" 2>/dev/null || true)" == 404 ]] || failures+=(public-admin-concealment)
if [[ -n "${ADMIN_ORIGIN:-}" ]]; then
  check admin-web curl --fail --silent --show-error --max-time "$timeout_seconds" "${ADMIN_ORIGIN}/admin"
fi

for service in arena-api arena-web arena-worker; do
  container_id="$(bounded_compose ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$container_id" ]]; then failures+=("container:$service:missing"); continue; fi
  state="$(bounded docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
  restarts="$(bounded docker inspect --format '{{.RestartCount}}' "$container_id" 2>/dev/null || echo 999)"
  health=none
  if [[ "$service" != arena-worker ]]; then
    health="$(bounded docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
  fi
  container_state_is_acceptable "$service" "$state" "$health" "$restarts" "${CONTAINER_RESTART_WARNING:-1}" || failures+=("container:$service:state")
done

if [[ "$POSTGRES_MODE" == container ]]; then
  bounded_compose --profile container-db exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t 5 >/dev/null 2>&1 || failures+=(postgres)
else
  check postgres pg_isready -d "$(<"$SERVER_APP_ROOT/shared/secrets/DATABASE_DIRECT_URL")" -t 5
fi
check nginx nginx -t
failed_units="$(bounded systemctl --failed --no-legend --plain 2>/dev/null || true)"
[[ -z "$failed_units" ]] || failures+=(systemd-failed-units)
[[ -L "$SERVER_APP_ROOT/current" && -d "$(readlink -f "$SERVER_APP_ROOT/current" 2>/dev/null || true)" ]] || failures+=(current-release)

disk_used="$(df -P "$SERVER_APP_ROOT" | awk 'NR==2 {gsub("%", "", $5); print $5}')"
inode_used="$(df -Pi "$SERVER_APP_ROOT" | awk 'NR==2 {gsub("%", "", $5); print $5}')"
(( disk_used < ${DISK_CRITICAL_PERCENT:-90} )) || failures+=(disk-critical)
(( inode_used < ${INODE_CRITICAL_PERCENT:-90} )) || failures+=(inode-critical)

latest="$(find "$SERVER_BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '*.partial' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"
if [[ -z "$latest" || ! -s "$latest/postgres.dump" || ! -f "$latest/SHA256SUMS" ]]; then
  failures+=(backup-missing)
else
  age_hours=$(( ($(date +%s) - $(stat -c %Y "$latest")) / 3600 ))
  (( age_hours <= ${BACKUP_MAX_AGE_HOURS:-36} )) || failures+=(backup-stale)
  (cd "$latest" && bounded sha256sum -c SHA256SUMS >/dev/null 2>&1) || failures+=(backup-checksum)
  validate_dump "$latest/postgres.dump" 2>/dev/null || failures+=(backup-dump-invalid)
fi

if [[ "${ENABLE_TLS:-false}" == true ]]; then
  tls_host="${APP_DOMAIN:?APP_DOMAIN required for TLS monitoring}"
  bounded openssl s_client -servername "$tls_host" -connect "$tls_host:443" </dev/null 2>/dev/null |
    openssl x509 -checkend "$(( ${TLS_EXPIRY_WARNING_DAYS:-21} * 86400 ))" -noout >/dev/null 2>&1 || failures+=(tls-expiry)
fi

status=healthy; ((${#failures[@]} == 0)) || status=unhealthy
tmp_result="$(mktemp "$state_dir/.last-result.XXXXXX")"
printf 'status=%s\ntimestamp=%s\nchecks_failed=%s\n' "$status" "$(date -u +%FT%TZ)" "${failures[*]:-none}" >"$tmp_result"
chmod 0640 "$tmp_result"; mv -f "$tmp_result" "$result"

previous="$(cat "$state_dir/alert-state" 2>/dev/null || true)"
notification_ok=true
if [[ "$status" != "$previous" && "${TELEGRAM_ALERTS_ENABLED:-false}" == true ]]; then
  [[ -r "${TELEGRAM_BOT_TOKEN_FILE:-}" && -r "${TELEGRAM_CHAT_ID_FILE:-}" ]] || notification_ok=false
  if [[ "$notification_ok" == true ]]; then
    token="$(<"$TELEGRAM_BOT_TOKEN_FILE")"; chat="$(<"$TELEGRAM_CHAT_ID_FILE")"
    message="Arena monitor: $status; ${failures[*]:-recovered}"
    curl --fail --silent --show-error --max-time "$timeout_seconds" --data-urlencode "chat_id=$chat" --data-urlencode "text=${message:0:1000}" "https://api.telegram.org/bot${token}/sendMessage" >/dev/null 2> >(redact >&2) || notification_ok=false
  fi
fi
if [[ "$notification_ok" == true ]]; then
  tmp_state="$(mktemp "$state_dir/.alert-state.XXXXXX")"; printf '%s' "$status" >"$tmp_state"; chmod 0640 "$tmp_state"; mv -f "$tmp_state" "$state_dir/alert-state"
fi
[[ "$status" == healthy ]]
