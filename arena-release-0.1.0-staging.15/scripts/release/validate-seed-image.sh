#!/usr/bin/env bash
set -Eeuo pipefail

[[ $# -eq 2 ]] || {
  echo "usage: $0 SEED_IMAGE MIGRATE_IMAGE" >&2
  exit 2
}

seed_image="$1"
migrate_image="$2"
network="arena-seed-test-$$"
postgres="arena-seed-postgres-$$"
password="$(openssl rand -hex 24)"
database=arena_seed_test
url="postgresql://arena:$password@$postgres:5432/$database"
log="$(mktemp)"

cleanup() {
  docker rm -f "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -f "$log"
}
trap cleanup EXIT

entrypoint="$(docker image inspect "$seed_image" --format '{{json .Config.Entrypoint}}')"
[[ "$entrypoint" == '["node","dist/seed-fc26-cli.js"]' ]] || {
  echo "seed image has an unexpected entrypoint: $entrypoint" >&2
  exit 3
}

runtime_user="$(docker image inspect "$seed_image" --format '{{.Config.User}}')"
[[ "$runtime_user" == 10001:10001 ]] || {
  echo "seed image must run as 10001:10001" >&2
  exit 4
}

if docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env DATABASE_URL=postgresql://offline:offline@127.0.0.1:1/offline \
  --env DATABASE_DIRECT_URL=postgresql://offline:offline@127.0.0.1:1/offline \
  "$seed_image" >"$log" 2>&1; then
  echo "offline seed probe unexpectedly succeeded" >&2
  exit 5
else
  probe_rc=$?
fi

if grep -Eqi \
  'pnpm (install|fetch)|corepack|registry\.npmjs\.org|npmjs\.org|prisma generate|package registry|EROFS' \
  "$log"; then
  echo "offline seed probe attempted a forbidden runtime operation" >&2
  tail -c 16384 "$log" >&2
  exit 6
fi
grep -Eqi 'ECONNREFUSED|Can.t reach database server|connection' "$log" || {
  echo "offline seed command did not reach database connection startup" >&2
  tail -c 16384 "$log" >&2
  exit 7
}
printf 'seed image offline validation passed: exit=%s user=%s\n' "$probe_rc" "$runtime_user"

docker network create "$network" >/dev/null
docker run -d --name "$postgres" --network "$network" \
  --env POSTGRES_DB="$database" \
  --env POSTGRES_USER=arena \
  --env POSTGRES_PASSWORD="$password" \
  postgres:17.10-alpine3.23 >/dev/null

for _ in $(seq 1 60); do
  docker exec "$postgres" pg_isready -U arena -d "$database" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$postgres" pg_isready -U arena -d "$database" >/dev/null

docker run --rm --network "$network" --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --env DATABASE_URL="$url" --env DATABASE_DIRECT_URL="$url" "$migrate_image"

run_seed() {
  docker run --rm --network "$network" --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --env DATABASE_URL="$url" --env DATABASE_DIRECT_URL="$url" "$seed_image"
}

run_seed
first_counts="$(
  docker exec "$postgres" psql -U arena -d "$database" -AtF '|' -c \
    "select
      (select count(*) from games),
      (select count(*) from game_modes),
      (select count(*) from games where slug='fc-26'),
      (select count(*) from game_modes where slug='one-v-one'),
      (select count(*) from game_rulesets),
      (select count(*) from player_ratings),
      (select count(*) from users),
      (select count(*) from matches);"
)"
IFS='|' read -r games modes fc26 one_v_one rulesets ratings users matches <<<"$first_counts"
(( games > 0 && modes > 0 && fc26 == 1 && one_v_one == 1 && rulesets > 0 ))
(( ratings == 0 && users == 0 && matches == 0 ))

run_seed
second_counts="$(
  docker exec "$postgres" psql -U arena -d "$database" -AtF '|' -c \
    "select
      (select count(*) from games),
      (select count(*) from game_modes),
      (select count(*) from games where slug='fc-26'),
      (select count(*) from game_modes where slug='one-v-one'),
      (select count(*) from game_rulesets),
      (select count(*) from player_ratings),
      (select count(*) from users),
      (select count(*) from matches);"
)"
[[ "$second_counts" == "$first_counts" ]] || {
  echo "seed is not idempotent: first=$first_counts second=$second_counts" >&2
  exit 8
}
printf 'seed disposable database validation passed: counts=%s\n' "$second_counts"
