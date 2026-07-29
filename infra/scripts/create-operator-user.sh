#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
id "$SERVER_OPERATOR_USER" >/dev/null 2>&1 || run useradd --create-home --shell /bin/bash "$SERVER_OPERATOR_USER"
run usermod -aG sudo "$SERVER_OPERATOR_USER"
[[ -n "${OPERATOR_PUBLIC_KEY_FILE:-}" && -f "$OPERATOR_PUBLIC_KEY_FILE" ]] || die "OPERATOR_PUBLIC_KEY_FILE is required"
if [[ "$DRY_RUN" == true ]] && ! id "$SERVER_OPERATOR_USER" >/dev/null 2>&1; then
  printf 'DRY-RUN: configure authorized_keys for future user %q\n' "$SERVER_OPERATOR_USER"
  exit 0
fi
home="$(getent passwd "$SERVER_OPERATOR_USER" | cut -d: -f6)"
ensure_dir "$home/.ssh" 0700 "$SERVER_OPERATOR_USER"
key="$(<"$OPERATOR_PUBLIC_KEY_FILE")"
[[ "$key" =~ ^ssh-(ed25519|rsa)[[:space:]] ]] || die "unsupported public key format"
auth="$home/.ssh/authorized_keys"
touch "$auth"; chown "$SERVER_OPERATOR_USER:$SERVER_OPERATOR_USER" "$auth"; chmod 0600 "$auth"
grep -qxF "$key" "$auth" || printf '%s\n' "$key" >>"$auth"
info "operator key installed; verify a second SSH session before finalizing hardening"
