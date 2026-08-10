#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
id "$SERVER_APP_USER" >/dev/null 2>&1 || run useradd --system --home-dir "$SERVER_APP_ROOT" --shell /usr/sbin/nologin "$SERVER_APP_USER"

# The containers run as the fixed numeric uid:gid 10001:10001 (see
# infra/compose/compose.base.yml `user: '10001:10001'`), which is unrelated
# to whatever uid the host SERVER_APP_USER account was assigned. site-assets
# is bind-mounted read/write into the API and worker containers, so it must
# be owned by 10001:10001 on the host or uploaded logos/hero images silently
# fail to write (and previously written ones could fail to read).
site_assets_dirs=(shared/uploads/site-assets)
app_dirs=(releases shared/env shared/secrets shared/uploads shared/data backups logs scripts run)

if [[ "$DRY_RUN" == true ]] && ! id "$SERVER_APP_USER" >/dev/null 2>&1; then
  for dir in "${app_dirs[@]}"; do
    printf 'DRY-RUN: create directory %q for future user %q\n' "$SERVER_APP_ROOT/$dir" "$SERVER_APP_USER"
  done
  for dir in "${site_assets_dirs[@]}"; do
    printf 'DRY-RUN: create directory %q owned by container uid:gid 10001:10001\n' "$SERVER_APP_ROOT/$dir"
  done
  printf 'DRY-RUN: create backup directory %q for future user %q\n' "$SERVER_BACKUP_ROOT" "$SERVER_APP_USER"
  exit 0
fi

for dir in "${app_dirs[@]}"; do
  mode=0750; [[ "$dir" == shared/secrets || "$dir" == shared/env ]] && mode=0700
  ensure_dir "$SERVER_APP_ROOT/$dir" "$mode" "$SERVER_APP_USER"
done

for dir in "${site_assets_dirs[@]}"; do
  ensure_dir "$SERVER_APP_ROOT/$dir" 0770 10001
done

ensure_dir "$SERVER_BACKUP_ROOT" 0700 "$SERVER_APP_USER"
