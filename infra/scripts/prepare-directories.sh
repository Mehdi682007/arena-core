#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
id "$SERVER_APP_USER" >/dev/null 2>&1 || run useradd --system --home-dir "$SERVER_APP_ROOT" --shell /usr/sbin/nologin "$SERVER_APP_USER"
if [[ "$DRY_RUN" == true ]] && ! id "$SERVER_APP_USER" >/dev/null 2>&1; then
  for dir in releases shared/env shared/secrets shared/uploads shared/data backups logs scripts run; do
    printf 'DRY-RUN: create directory %q for future user %q\n' "$SERVER_APP_ROOT/$dir" "$SERVER_APP_USER"
  done
  printf 'DRY-RUN: create backup directory %q for future user %q\n' "$SERVER_BACKUP_ROOT" "$SERVER_APP_USER"
  exit 0
fi
for dir in releases shared/env shared/secrets shared/uploads shared/data backups logs scripts run; do
  mode=0750; [[ "$dir" == shared/secrets || "$dir" == shared/env ]] && mode=0700
  ensure_dir "$SERVER_APP_ROOT/$dir" "$mode" "$SERVER_APP_USER"
done
ensure_dir "$SERVER_BACKUP_ROOT" 0700 "$SERVER_APP_USER"
