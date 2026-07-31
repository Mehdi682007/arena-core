#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"; source "$SCRIPT_DIR/lib/compose.sh"; source "$SCRIPT_DIR/lib/images.sh"
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
  docker run --rm -i -v "$SERVER_APP_ROOT/shared/secrets:/run/arena-secrets:ro" \
    postgres:17.10-alpine3.23 sh -ec \
    'pg_dump --dbname="$(cat /run/arena-secrets/DATABASE_DIRECT_URL)" -Fc' >"$partial/postgres.dump"
  docker run --rm -i postgres:17.10-alpine3.23 pg_restore -l <"$partial/postgres.dump" >/dev/null
fi
rsync -a --exclude='secrets/*' "$SERVER_APP_ROOT/shared/uploads/" "$partial/uploads/"
cp "$SERVER_APP_ROOT/shared/deployment.json" "$partial/" 2>/dev/null || true
find "$SERVER_APP_ROOT/shared/secrets" -maxdepth 1 -type f -printf '%f\n' | sort >"$partial/secret-inventory.txt"
(cd "$partial" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum >SHA256SUMS)
chown -R root:root "$partial"; chmod -R go-rwx "$partial"
mv "$partial" "$target"; trap - ERR INT TERM; info "backup complete: $target"
