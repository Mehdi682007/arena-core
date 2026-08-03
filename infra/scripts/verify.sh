#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/secrets.sh"; source "$SCRIPT_DIR/lib/compose.sh"
parse_common_args "$@"
[[ -z "${ARENA_VERIFY_RELEASE_VERSION:-}" ]] || RELEASE_VERSION="$ARENA_VERIFY_RELEASE_VERSION"
export RELEASE_VERSION
export_runtime_paths
report="${VERIFY_REPORT:-$SERVER_APP_ROOT/logs/verify.json}"; status=PASS
VERIFY_READINESS_TIMEOUT_SECONDS="${VERIFY_READINESS_TIMEOUT_SECONDS:-120}"
VERIFY_READINESS_INTERVAL_SECONDS="${VERIFY_READINESS_INTERVAL_SECONDS:-2}"
VERIFY_DIAGNOSTIC_MAX_BYTES="${VERIFY_DIAGNOSTIC_MAX_BYTES:-16384}"
if [[ ! "$VERIFY_READINESS_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] ||
  (( VERIFY_READINESS_TIMEOUT_SECONDS < 10 || VERIFY_READINESS_TIMEOUT_SECONDS > 600 )); then
  die "VERIFY_READINESS_TIMEOUT_SECONDS must be between 10 and 600"
fi
if [[ ! "$VERIFY_READINESS_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] ||
  (( VERIFY_READINESS_INTERVAL_SECONDS < 1 || VERIFY_READINESS_INTERVAL_SECONDS > 10 )); then
  die "VERIFY_READINESS_INTERVAL_SECONDS must be between 1 and 10"
fi
if [[ ! "$VERIFY_DIAGNOSTIC_MAX_BYTES" =~ ^[0-9]+$ ]] ||
  (( VERIFY_DIAGNOSTIC_MAX_BYTES < 1024 || VERIFY_DIAGNOSTIC_MAX_BYTES > 65536 )); then
  die "VERIFY_DIAGNOSTIC_MAX_BYTES must be between 1024 and 65536"
fi

check() {
  local label="$1"; shift
  if ! "$@" >/dev/null 2>&1; then
    warn "$label verification failed"
    status=FAIL
    return 1
  fi
}
sanitize_diagnostics() {
  sed -E \
    -e 's#(postgres(ql)?://)[^/@[:space:]]+@#\1[REDACTED]@#gI' \
    -e 's#(authorization:[[:space:]]*(bearer|basic))[[:space:]]+[^[:space:]]+#\1 [REDACTED]#gI' \
    -e 's#((password|secret|token|cookie|dsn)[=:])[[:space:]]*[^[:space:]]+#\1[REDACTED]#gI' |
    tail -c "$VERIFY_DIAGNOSTIC_MAX_BYTES"
}
service_diagnostics() {
  local service="$1"
  warn "$service readiness diagnostics (bounded and redacted) follow"
  {
    compose ps "$service" || true
    compose logs --no-color --tail 80 "$service" || true
  } 2>&1 | sanitize_diagnostics >&2
}
wait_for_http() {
  local service="$1" url="$2" expected="${3:-}" host_header="${4:-}" started="$SECONDS" body
  local -a curl_args=(-fsS --max-time 5)

  [[ -z "$host_header" ]] || curl_args+=(-H "Host: $host_header")

  while (( SECONDS - started < VERIFY_READINESS_TIMEOUT_SECONDS )); do
    if body="$(curl "${curl_args[@]}" "$url" 2>/dev/null)"; then
      if [[ -z "$expected" || "$body" == "$expected" ]]; then
        info "$service became ready"
        return 0
      fi
    fi
    sleep "$VERIFY_READINESS_INTERVAL_SECONDS"
  done
  warn "$service did not become ready within ${VERIFY_READINESS_TIMEOUT_SECONDS}s"
  service_diagnostics "$service"
  return 1
}
wait_for_worker() {
  local started="$SECONDS" container state restarts stable_samples=0
  while (( SECONDS - started < VERIFY_READINESS_TIMEOUT_SECONDS )); do
    container="$(compose ps -q arena-worker 2>/dev/null || true)"
    if [[ -n "$container" ]]; then
      state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
      restarts="$(docker inspect --format '{{.RestartCount}}' "$container" 2>/dev/null || true)"
      if [[ "$state" == running && "$restarts" == 0 ]]; then
        (( stable_samples += 1 ))
        if (( stable_samples >= 2 )); then
          info "arena-worker remained running with zero restarts"
          return 0
        fi
      elif [[ "$state" == exited || "$state" == dead || "${restarts:-0}" -gt 0 ]]; then
        warn "arena-worker exited early or restarted (state=${state:-unknown}, restarts=${restarts:-unknown})"
        service_diagnostics arena-worker
        return 1
      else
        stable_samples=0
      fi
    fi
    sleep "$VERIFY_READINESS_INTERVAL_SECONDS"
  done
  warn "arena-worker did not remain stable within ${VERIFY_READINESS_TIMEOUT_SECONDS}s"
  service_diagnostics arena-worker
  return 1
}

check "Docker" systemctl is-active docker || true
check "Nginx" systemctl is-active nginx || true
check "NTP synchronization" timedatectl show -p NTPSynchronized --value || true
check "Compose" compose ps || true
wait_for_worker || status=FAIL
wait_for_http arena-api http://127.0.0.1:3001/api/v1/health/ready || status=FAIL
wait_for_http arena-web http://127.0.0.1:3000/api/health '' "$APP_DOMAIN" || status=FAIL
proxy_host="${APP_DOMAIN:-${SERVER_HOST:-localhost}}"
if ! proxy_body="$(curl -fsS --max-time 5 http://127.0.0.1:8088/arena-proxy-health 2>/dev/null)" ||
  [[ "$proxy_body" != ok ]]; then
  warn "Nginx proxy-health contract failed"
  status=FAIL
fi
if [[ "$ENABLE_TLS" == true ]]; then
  check "Nginx TLS API upstream" curl -fsS --max-time 5 \
    --resolve "$proxy_host:443:127.0.0.1" "https://$proxy_host/api/v1/health/ready" || true
  check "public admin concealment" test "$(curl -ksS -o /dev/null -w '%{http_code}' --resolve "$APP_DOMAIN:443:127.0.0.1" "https://$APP_DOMAIN/admin")" = 404 || true
  check "admin root redirect" test "$(curl -ksS -o /dev/null -w '%{redirect_url}' --resolve "$ADMIN_DOMAIN:443:127.0.0.1" "https://$ADMIN_DOMAIN/")" = "https://$ADMIN_DOMAIN/admin" || true
  check "admin login page" curl -ksSf --max-time 5 --resolve "$ADMIN_DOMAIN:443:127.0.0.1" "https://$ADMIN_DOMAIN/login?returnTo=%2Fadmin" || true
  admin_status="$(curl -ksS -o /dev/null -w '%{http_code}' --resolve "$ADMIN_DOMAIN:443:127.0.0.1" "https://$ADMIN_DOMAIN/admin")"
  [[ "$admin_status" == 200 || "$admin_status" == 307 ]] || { warn "admin route returned unexpected status $admin_status"; status=FAIL; }
  certificate="$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$APP_DOMAIN" 2>/dev/null | openssl x509 -noout -ext subjectAltName 2>/dev/null || true)"
  [[ "$certificate" == *"DNS:$APP_DOMAIN"* && "$certificate" == *"DNS:$ADMIN_DOMAIN"* ]] || { warn "TLS certificate does not cover both domains"; status=FAIL; }
else
  check "Nginx API upstream" curl -fsS --max-time 5 -H "Host: $proxy_host" \
    http://127.0.0.1/api/v1/health/ready || true
fi
if [[ "$POSTGRES_MODE" == container ]]; then
  check "PostgreSQL" compose --profile container-db exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || true
else
  # shellcheck disable=SC2016 # DATABASE_DIRECT_URL is expanded inside the utility container.
  check "external PostgreSQL" docker run --rm --add-host host.docker.internal:host-gateway -v "$SERVER_APP_ROOT/shared/secrets:/run/arena-secrets:ro" \
    postgres:17.10-alpine3.23 sh -ec \
    'pg_isready --dbname="$(cat /run/arena-secrets/DATABASE_DIRECT_URL)"' || true
fi
ss -lnt | grep -Eq '(^|:)5432[[:space:]]' && status=FAIL
ss -lnt | grep -Eq '(^|:)2375[[:space:]]|(^|:)2376[[:space:]]' && status=FAIL
validate_secret_files
if [[ "$DRY_RUN" == true ]]; then
  info "verification inspection status: $status; no report written"
else
  umask 077
  printf '{"status":"%s","timestamp":"%s","environment":"%s"}\n' \
    "$status" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$ENVIRONMENT" >"$report"
  info "verification status: $status; JSON report: $report"
fi
[[ "$status" == PASS ]]
