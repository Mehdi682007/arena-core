#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd -- "$(dirname -- "$0")" && pwd -P)"
exec bash "$script_dir/provision.sh" "$@"
