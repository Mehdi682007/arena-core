#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/secrets.sh"; source "$SCRIPT_DIR/lib/compose.sh"
parse_common_args "$@"
[[ -z "${ARENA_VERIFY_RELEASE_VERSION:-}" ]] || RELEASE_VERSION="$ARENA_VERIFY_RELEASE_VERSION"
export_runtime_paths
report="${VERIFY_REPORT:-$SERVER_APP_ROOT/logs/verify.json}"; status=PASS
check() { "$@" >/dev/null 2>&1 || status=FAIL; }
check systemctl is-active docker; check systemctl is-active nginx; check timedatectl show -p NTPSynchronized --value
check compose ps; check curl -fsS http://127.0.0.1/arena-proxy-health; check curl -fsS http://127.0.0.1/api/v1/health/ready
if [[ "$POSTGRES_MODE" == container ]]; then
  check compose --profile container-db exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
else
  check docker run --rm -v "$SERVER_APP_ROOT/shared/secrets:/run/arena-secrets:ro" \
    postgres:17.10-alpine3.23 sh -ec \
    'pg_isready --dbname="$(cat /run/arena-secrets/DATABASE_DIRECT_URL)"'
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
