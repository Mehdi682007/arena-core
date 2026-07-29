#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/secrets.sh"
parse_common_args "$@"; require_root
validate_secret_files
if [[ "$DRY_RUN" == true ]]; then
  info "runtime environment inputs validated; no temporary or runtime file created"
  exit 0
fi
target="$SERVER_APP_ROOT/shared/env/runtime.env"; tmp="$(mktemp)"
trap 'rm -f -- "$tmp"' EXIT
base="${APP_DOMAIN:-$SERVER_HOST}"; scheme=http; [[ "$ENABLE_TLS" == true ]] && scheme=https
{
  printf 'APP_ENV=%s\nNODE_ENV=production\n' "$ENVIRONMENT"
  printf 'APP_BASE_URL=%s://%s\nWEB_BASE_URL=%s://%s\nAPI_BASE_URL=%s://%s/api\n' "$scheme" "$base" "$scheme" "$base" "$scheme" "$base"
  printf 'LOG_LEVEL=info\nHOST=0.0.0.0\nAPI_PORT=3001\nAPI_PREFIX=/api/v1\nCORS_ENABLED=false\nWORKER_SHUTDOWN_TIMEOUT_MS=10000\n'
  printf 'AUTH_ALLOWED_ORIGINS=%s://%s\nIDENTITY_PUBLIC_BASE_URL=%s://%s\n' "$scheme" "$base" "$scheme" "$base"
  printf 'DATABASE_ENABLED=true\n'
  if [[ "$POSTGRES_MODE" == container ]]; then
    printf 'DATABASE_URL=postgresql://%s:' "$POSTGRES_USER"
    tr -d '\r\n' <"$(secret_path POSTGRES_PASSWORD)"
    printf '@postgres:5432/%s\nDATABASE_DIRECT_URL=postgresql://%s:' "$POSTGRES_DB" "$POSTGRES_USER"
    tr -d '\r\n' <"$(secret_path POSTGRES_PASSWORD)"
    printf '@postgres:5432/%s\n' "$POSTGRES_DB"
  else
    printf 'DATABASE_URL='; tr -d '\r\n' <"$(secret_path DATABASE_URL)"; printf '\n'
    printf 'DATABASE_DIRECT_URL='; tr -d '\r\n' <"$(secret_path DATABASE_DIRECT_URL)"; printf '\n'
  fi
  for key in SESSION_SECRET CSRF_SECRET AUTH_TOKEN_HASH_KEY AUTH_IP_HASH_KEY; do
    printf '%s=' "$key"; tr -d '\r\n' <"$(secret_path "$key")"; printf '\n'
  done
  printf 'SMTP_ENABLED=false\nTRUST_PROXY_MODE=hop-count\nTRUST_PROXY_HOPS=1\n'
  printf 'ALLOWED_ORIGINS=%s://%s\nCORS_ALLOW_NO_ORIGIN=false\nCOOKIE_SECURE=%s\n' "$scheme" "$base" "$ENABLE_TLS"
  printf 'RATE_LIMIT_ENABLED=true\nMIGRATION_MODE=external\nBUILD_SHA=%s\nRELEASE_VERSION=%s\n' "${BUILD_SHA:-uncommitted}" "$RELEASE_VERSION"
} >"$tmp"
install -m 0600 -o "$SERVER_APP_USER" -g "$SERVER_APP_USER" "$tmp" "$target"
info "runtime environment created with restricted permissions; values were not logged"
