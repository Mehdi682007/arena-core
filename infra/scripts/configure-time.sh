#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
parse_common_args "$@"; require_root
run timedatectl set-timezone UTC
run systemctl enable --now chrony
timedatectl show -p Timezone -p NTPSynchronized
