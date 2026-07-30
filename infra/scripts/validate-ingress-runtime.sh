#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project="arena-ingress-test-${GITHUB_RUN_ID:-$$}"
tmp_dir="$(mktemp -d)"
compose=(
  docker compose
  --project-name "$project"
  --project-directory "$repo_root"
  -f "$repo_root/infra/compose/compose.base.yml"
  -f "$repo_root/infra/compose/compose.automation.staging.yml"
  -f "$repo_root/infra/compose/compose.ingress-test.yml"
)

cleanup() {
  "${compose[@]}" down --remove-orphans >/dev/null 2>&1 || true
  rm -r -- "$tmp_dir"
}
trap cleanup EXIT

: >"$tmp_dir/runtime.env"
mkdir -p "$tmp_dir/secrets"
printf 'not-used-by-ingress-test\n' >"$tmp_dir/secrets/POSTGRES_PASSWORD"

export ARENA_ENV_FILE="$tmp_dir/runtime.env"
export ARENA_SECRETS_DIR="$tmp_dir/secrets"
export ARENA_API_IMAGE=alpine:3.23
export ARENA_WORKER_IMAGE=alpine:3.23
export ARENA_WEB_IMAGE=alpine:3.23
export ARENA_MIGRATE_IMAGE=alpine:3.23
export POSTGRES_DB=arena
export POSTGRES_USER=arena

"${compose[@]}" config --quiet
"${compose[@]}" up -d --no-deps arena-api arena-web

api_id="$("${compose[@]}" ps -q arena-api)"
web_id="$("${compose[@]}" ps -q arena-web)"
[[ -n "$api_id" && -n "$web_id" ]]

inspect_port() {
  local id="$1" port="$2" expected="$3"
  local host_config runtime
  host_config="$(docker inspect --format "{{json (index .HostConfig.PortBindings \"$port/tcp\")}}" "$id")"
  runtime="$(docker inspect --format "{{json (index .NetworkSettings.Ports \"$port/tcp\")}}" "$id")"
  printf 'port=%s host_config=%s runtime=%s\n' "$port" "$host_config" "$runtime"
  [[ "$host_config" == *"$expected"* ]]
  [[ "$runtime" == *"$expected"* ]]
  [[ "$(docker port "$id" "$port/tcp")" == "$expected" ]]
}

inspect_port "$api_id" 3001 "127.0.0.1:3001"
inspect_port "$web_id" 3000 "127.0.0.1:3000"

for tuple in "$api_id:ingress" "$api_id:app" "$api_id:data" "$web_id:ingress" "$web_id:app"; do
  id="${tuple%%:*}"
  suffix="${tuple#*:}"
  docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' "$id" |
    grep -Eq "_${suffix}$"
done

for port in 3000 3001; do
  if ss -ltn "sport = :$port" | grep -Fq "127.0.0.1:$port"; then
    printf 'listener=127.0.0.1:%s\n' "$port"
  else
    printf 'listener=kernel-nat:%s (no userland proxy socket)\n' "$port"
  fi
  if ss -ltn "sport = :$port" | grep -Eq "(0\.0\.0\.0|\[::\]):$port"; then
    printf 'unexpected wildcard listener for port %s\n' "$port" >&2
    exit 1
  fi
done

curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3001 >/dev/null
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3000 >/dev/null
printf 'loopback connectivity passed\n'

for service in postgres arena-worker; do
  [[ -z "$("${compose[@]}" ps -q "$service")" ]]
done

printf 'Ingress runtime validation passed.\n'
