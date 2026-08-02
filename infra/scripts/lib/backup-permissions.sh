#!/usr/bin/env bash
set -Eeuo pipefail

secure_backup_tree() {
  local path="${1:?backup path required}"
  chmod -R go-rwx "$path"
  find "$path" -type d -exec chmod 0700 {} +
  find "$path" -type f -exec chmod 0600 {} +
  if ((EUID == 0)); then
    chown -R root:root "$path"
  fi
}
