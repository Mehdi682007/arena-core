#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"; source "$SCRIPT_DIR/lib/images.sh"; source "$SCRIPT_DIR/lib/backup-permissions.sh"
parse_common_args "$@"; export_runtime_paths
configure_release_images "$ARENA_RELEASE_DIR" "$RELEASE_VERSION"
compose config --quiet
if [[ "$DRY_RUN" == true ]]; then
  info "backup dry-run validated inventory and paths; no lock, directory, dump, or checksum file created"
  exit 0
fi
if [[ "${BACKUP_TEST_MODE:-false}" == true ]]; then
  printf '%s\n' 'TEST MODE: pg_dump custom format, checksums, manifest, atomic directory rename'
  exit 0
fi
if [[ "${ARENA_LIFECYCLE_LOCK_HELD:-false}" != true ]]; then
  acquire_lock "$SERVER_APP_ROOT/run/deploy.lock"
fi
acquire_lock "$SERVER_APP_ROOT/run/backup.lock"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"; target="$SERVER_BACKUP_ROOT/$timestamp"; partial="$target.partial"
cleanup_partial() { [[ ! -e "$partial" ]] || rm -rf -- "$partial"; }
trap cleanup_partial ERR INT TERM
required_kb=$(( ${BACKUP_MIN_FREE_MB:-1024} * 1024 ))
available_kb="$(df -Pk "$SERVER_BACKUP_ROOT" | awk 'NR==2 {print $4}')"
((available_kb >= required_kb)) || die "insufficient backup space: ${available_kb}KiB available, ${required_kb}KiB required"
mkdir -m 0700 "$partial"
if [[ "$POSTGRES_MODE" == container ]]; then
  compose --profile container-db exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$partial/postgres.dump"
  compose --profile container-db exec -T postgres pg_restore -l <"$partial/postgres.dump" >/dev/null
else
  docker run --rm -i --add-host host.docker.internal:host-gateway -v "$SERVER_APP_ROOT/shared/secrets:/run/arena-secrets:ro" \
    postgres:17.10-alpine3.23 sh -ec \
    'pg_dump --dbname="$(cat /run/arena-secrets/DATABASE_DIRECT_URL)" -Fc' >"$partial/postgres.dump"
  docker run --rm -i --add-host host.docker.internal:host-gateway postgres:17.10-alpine3.23 pg_restore -l <"$partial/postgres.dump" >/dev/null
fi
rsync -a --exclude='secrets/*' "$SERVER_APP_ROOT/shared/uploads/" "$partial/uploads/"
cp "$SERVER_APP_ROOT/shared/deployment.json" "$partial/" 2>/dev/null || true
find "$SERVER_APP_ROOT/shared/secrets" -maxdepth 1 -type f -printf '%f\n' | sort >"$partial/secret-inventory.txt"
(cd "$partial" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum >SHA256SUMS)
secure_backup_tree "$partial"
mv "$partial" "$target"; trap - ERR INT TERM

retention="${BACKUP_RETENTION_DAYS:-14}"
cleanup_limit="${BACKUP_CLEANUP_LIMIT:-100}"
[[ "$retention" =~ ^[0-9]+$ && "$retention" -ge 1 ]] || die "invalid BACKUP_RETENTION_DAYS"
[[ "$cleanup_limit" =~ ^[0-9]+$ && "$cleanup_limit" -ge 1 ]] || die "invalid BACKUP_CLEANUP_LIMIT"
valid_dump() {
  if [[ "$POSTGRES_MODE" == container ]]; then
    compose --profile container-db exec -T postgres pg_restore -l <"$1" >/dev/null 2>&1
  else
    docker run --rm -i --add-host host.docker.internal:host-gateway postgres:17.10-alpine3.23 pg_restore -l <"$1" >/dev/null 2>&1
  fi
}
mapfile -t candidates < <(
  find "$SERVER_BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '*.partial' -printf '%T@ %p\n' |
    sort -nr | head -n "$((retention + cleanup_limit))" | cut -d' ' -f2-
)
valid=()
for candidate in "${candidates[@]}"; do
  [[ -f "$candidate/SHA256SUMS" && -s "$candidate/postgres.dump" ]] || continue
  (cd "$candidate" && sha256sum -c SHA256SUMS >/dev/null) || continue
  valid_dump "$candidate/postgres.dump" || continue
  valid+=("$candidate")
done
deleted=0
for candidate in "${valid[@]:$retention}"; do
  (( deleted < cleanup_limit )) || break
  [[ "$candidate" != "$target" && -w "$candidate" && -w "$SERVER_BACKUP_ROOT" ]] || continue
  rm -rf -- "$candidate"
  ((deleted += 1))
done
info "backup complete: $target; retained newest $retention successful backups; removed $deleted"
