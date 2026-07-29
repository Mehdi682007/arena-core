#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"
[[ "$(id -un)" == "$SERVER_OPERATOR_USER" ]] || die "must run inside the new operator session"
[[ -n "${SSH_CONNECTION:-}" ]] || die "not an SSH session"
[[ -n "${SSH_USER_AUTH:-}" && -f "$SSH_USER_AUTH" && ! -L "$SSH_USER_AUTH" ]] || die "OpenSSH authentication evidence unavailable"
grep -Eq '^publickey ' "$SSH_USER_AUTH" || die "this session was not authenticated with a public key"
sudo -n true 2>/dev/null || sudo true
sudo install -d -m 0755 /var/lib/arena
evidence="$(mktemp)"
trap 'rm -f -- "$evidence"' EXIT
printf 'user=%s\nmethod=publickey\nverifiedAt=%s\n' "$SERVER_OPERATOR_USER" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >"$evidence"
sudo install -m 0600 -o root -g root "$evidence" /var/lib/arena/operator-key-verified
info "independent operator session verified"
