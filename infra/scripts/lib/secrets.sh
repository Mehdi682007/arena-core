#!/usr/bin/env bash
set -Eeuo pipefail

required_secret_names() {
  if [[ "${POSTGRES_MODE:-container}" == container ]]; then
    printf '%s\n' POSTGRES_PASSWORD
  else
    printf '%s\n' DATABASE_URL DATABASE_DIRECT_URL
  fi
  printf '%s\n' SESSION_SECRET CSRF_SECRET AUTH_TOKEN_HASH_KEY AUTH_IP_HASH_KEY
  [[ "${SMTP_ENABLED:-false}" != true ]] || printf '%s\n' SMTP_PASSWORD
}
secret_path() { printf '%s/shared/secrets/%s\n' "$SERVER_APP_ROOT" "$1"; }
validate_secret_files() {
  local name file mode
  while IFS= read -r name; do
    file="$(secret_path "$name")"
    [[ -f "$file" ]] || die "required secret file missing: $name"
    mode="$(stat -c '%a' "$file")"
    [[ "$mode" == 600 || "$mode" == 400 ]] || die "unsafe permissions for secret: $name"
  done < <(required_secret_names)
}
