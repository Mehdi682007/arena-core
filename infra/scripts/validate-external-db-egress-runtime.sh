#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project="arena-db-egress-test-${GITHUB_RUN_ID:-$$}"
host_test_port="${HOST_TEST_PORT:-25432}"
tmp_dir="$(mktemp -d)"
compose=(
  docker compose
  --project-name "$project"
  --project-directory "$repo_root"
  -f "$repo_root/infra/compose/compose.db-egress-test.yml"
)

cleanup() {
  "${compose[@]}" --profile negative down --remove-orphans >/dev/null 2>&1 || true
  [[ -z "${listener_pid:-}" ]] || kill "$listener_pid" >/dev/null 2>&1 || true
  rm -r -- "$tmp_dir"
}
trap cleanup EXIT

HOST_TEST_PORT="$host_test_port" "${compose[@]}" config --quiet

python3 -m http.server "$host_test_port" --bind 0.0.0.0 \
  --directory "$tmp_dir" >"$tmp_dir/listener.log" 2>&1 &
listener_pid=$!

for _ in {1..20}; do
  if python3 - "$host_test_port" <<'PY'
import socket, sys
with socket.create_connection(('127.0.0.1', int(sys.argv[1])), timeout=0.5):
    pass
PY
  then
    break
  fi
  sleep 0.25
done
if ! kill -0 "$listener_pid" 2>/dev/null; then
  printf 'Host-side test listener did not become ready\n' >&2
  sed -n '1,40p' "$tmp_dir/listener.log" >&2
  exit 1
fi

HOST_TEST_PORT="$host_test_port" "${compose[@]}" run --rm egress-probe

if HOST_TEST_PORT="$host_test_port" "${compose[@]}" --profile negative run --rm internal-only-probe; then
  printf 'internal-only probe unexpectedly reached the host endpoint\n' >&2
  exit 1
fi

printf 'External database egress runtime validation passed.\n'
