#!/usr/bin/env bash
set -Eeuo pipefail

[[ $# -eq 1 ]] || {
  echo "usage: $0 IMAGE_REFERENCE" >&2
  exit 2
}

image="$1"
expected_pnpm_version=11.9.0
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

entrypoint="$(docker image inspect "$image" --format '{{json .Config.Entrypoint}}')"
[[ "$entrypoint" == '["/app/node_modules/.bin/prisma","migrate","deploy","--config","prisma.config.ts"]' ]] || {
  echo "migration image has an unexpected entrypoint: $entrypoint" >&2
  exit 3
}

pnpm_executable="$(
  docker run --rm --network none \
    --entrypoint /bin/sh \
    "$image" -c '
      test -x /usr/local/bin/pnpm
      readlink -f /usr/local/bin/pnpm
    '
)"
[[ -n "$pnpm_executable" && "$pnpm_executable" != *corepack* ]] || {
  echo "migration image pnpm is missing or resolves through Corepack" >&2
  exit 4
}

packaged_pnpm_version="$(
  docker run --rm --network none \
    --entrypoint /usr/local/bin/node \
    "$image" -p "require('/usr/local/lib/node_modules/pnpm/package.json').version"
)"
[[ "$packaged_pnpm_version" == "$expected_pnpm_version" ]] || {
  echo "migration image does not contain packaged pnpm $expected_pnpm_version" >&2
  exit 5
}

actual_pnpm_version="$(
  docker run --rm --network none \
    --entrypoint /usr/local/bin/pnpm \
    "$image" --version
)"
[[ "$actual_pnpm_version" == "$expected_pnpm_version" ]] || {
  echo "migration image pnpm mismatch: expected $expected_pnpm_version" >&2
  exit 6
}

if docker run --rm --network none \
  --env DATABASE_URL=postgresql://offline:offline@127.0.0.1:1/offline \
  --env DATABASE_DIRECT_URL=postgresql://offline:offline@127.0.0.1:1/offline \
  "$image" >"$log" 2>&1; then
  echo "offline migration probe unexpectedly succeeded" >&2
  exit 7
else
  probe_rc=$?
fi

if grep -Eqi \
  'corepack|registry\.npmjs\.org|fetchLatestStableVersion|package registry' \
  "$log"; then
  echo "offline migration probe attempted package resolution or network lookup" >&2
  exit 8
fi

grep -Eqi 'P1001|Can.t reach database server|Prisma schema loaded' "$log" || {
  echo "offline migration command did not reach Prisma startup" >&2
  sed -n '1,80p' "$log" >&2
  exit 9
}

printf 'migration image offline validation passed: pnpm=%s probe_exit=%s\n' \
  "$actual_pnpm_version" "$probe_rc"
