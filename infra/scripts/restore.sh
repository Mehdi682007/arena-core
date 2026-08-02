#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"
[[ $# -ge 2 ]] || die "usage: $0 INVENTORY BACKUP_DIR"
inventory="$1"; backup="$2"; shift 2; load_inventory "$inventory"; export_runtime_paths
if [[ "${RESTORE_TEST_MODE:-false}" == true ]]; then
  printf '%s\n' 'TEST MODE: backup/checksum validation, staging confirmation, guarded pg_restore'
  exit 0
fi
[[ "${RESTORE_CONFIRM:-}" == RESTORE_ARENA_STAGING ]] || die "RESTORE_CONFIRM=RESTORE_ARENA_STAGING required"
[[ "$ENVIRONMENT" == staging ]] || die "production restore is not automated by this command"
[[ -f "$backup/postgres.dump" && -f "$backup/SHA256SUMS" ]] || die "invalid backup"
(cd "$backup" && sha256sum -c SHA256SUMS)
acquire_lock "$SERVER_APP_ROOT/run/deploy.lock"
acquire_lock "$SERVER_APP_ROOT/run/restore.lock"
compose stop arena-api arena-worker arena-web
restart_application() { compose up -d arena-api arena-worker arena-web || true; }
trap restart_application ERR INT TERM
if [[ "$POSTGRES_MODE" == container ]]; then
  compose --profile container-db up -d --wait postgres
  compose --profile container-db exec -T postgres pg_restore --clean --if-exists --no-owner --exit-on-error \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" <"$backup/postgres.dump"
else
  docker run --rm -i -v "$SERVER_APP_ROOT/shared/secrets:/run/arena-secrets:ro" \
    postgres:17.10-alpine3.23 sh -ec \
    'pg_restore --dbname="$(cat /run/arena-secrets/DATABASE_DIRECT_URL)" --clean --if-exists --no-owner --exit-on-error' \
    <"$backup/postgres.dump"
fi
restart_application; trap - ERR INT TERM
"$SCRIPT_DIR/verify.sh" "$inventory"
info "restore complete and application verification passed"
