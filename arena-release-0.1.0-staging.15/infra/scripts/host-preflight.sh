#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"
source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"
report="${PREFLIGHT_REPORT:-/tmp/arena-host-preflight.json}"
source /etc/os-release
arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
supported=false
[[ "$ID" == ubuntu && ("$VERSION_ID" == 22.04 || "$VERSION_ID" == 24.04) ]] && supported=true
[[ "$arch" == amd64 || "$arch" == arm64 ]] || supported=false
[[ "$supported" == true || "$ALLOW_SUPPORTED_OS_OVERRIDE" == true ]] || die "unsupported host: $ID $VERSION_ID $arch"
docker=false; command -v docker >/dev/null && docker=true
ufw=false; command -v ufw >/dev/null && ufw=true
nginx=false; command -v nginx >/dev/null && nginx=true
already=false; [[ -f /var/lib/arena/provisioned ]] && already=true
umask 077
payload="$(printf '{"status":"PASS","os":"%s","version":"%s","architecture":"%s","docker":%s,"ufw":%s,"nginx":%s,"alreadyProvisioned":%s,"memoryKiB":%s,"diskAvailableKiB":%s}' \
  "$ID" "$VERSION_ID" "$arch" "$docker" "$ufw" "$nginx" "$already" \
  "$(awk '/MemTotal/{print $2}' /proc/meminfo)" "$(df -Pk / | awk 'NR==2{print $4}')")"
if [[ "$DRY_RUN" == true ]]; then
  printf 'DRY-RUN: preflight result %s\n' "$payload"
else
  printf '%s\n' "$payload" >"$report"
  info "machine-readable preflight written to $report"
fi
