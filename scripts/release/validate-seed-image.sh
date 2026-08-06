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
    --env DATABASE_URL="$url" \
    --env DATABASE_DIRECT_URL="$url" \
    "$seed_image"
}

query_scalar() {
  docker exec "$postgres" \
    psql \
    -U arena \
    -d "$database" \
    -qAt \
    -v ON_ERROR_STOP=1 \
    -c "$1"
}

seed_counts() {
  query_scalar \
    "select
      (select count(*) from games),
      (select count(*) from game_modes),
      (select count(*) from games where slug='fc-26'),
      (select count(*) from game_modes where slug='one-v-one'),
      (select count(*) from game_rulesets),
      (select count(*) from permissions),
      (select count(*) from roles),
      (select count(*) from role_permissions),
      (
        select count(*)
        from role_permissions rp
        join roles r on r.id = rp.role_id
        join permissions p on p.id = rp.permission_id
        where r.key = 'super_admin'
          and p.key = 'users.verify_email'
      ),
      (select count(*) from player_ratings),
      (select count(*) from users),
      (select count(*) from matches);"
}

run_seed

first_counts="$(seed_counts)"

IFS='|' read -r \
  games \
  modes \
  fc26 \
  one_v_one \
  rulesets \
  permissions \
  roles \
  role_permissions \
  verify_email_memberships \
  ratings \
  users \
  matches \
  <<<"$first_counts"

((games > 0))
((modes > 0))
((fc26 == 1))
((one_v_one == 1))
((rulesets > 0))
((permissions > 0))
((roles > 0))
((role_permissions > 0))
((verify_email_memberships == 1))
((ratings == 0))
((users == 0))
((matches == 0))

query_scalar \
  "with inserted_permission as (
    insert into permissions (
      key,
      description,
      created_at
    )
    values (
      'arena.test.custom',
      'Disposable Seed validation permission.',
      now()
    )
    returning id
  ),
  inserted_role as (
    insert into roles (
      key,
      name,
      description,
      is_system,
      created_at,
      updated_at
    )
    values (
      'arena_test_custom',
      'Arena Test Custom',
      'Disposable Seed validation role.',
      false,
      now(),
      now()
    )
    returning id
  )
  insert into role_permissions (
    role_id,
    permission_id,
    created_at
  )
  select
    inserted_role.id,
    inserted_permission.id,
    now()
  from inserted_role
  cross join inserted_permission;"

counts_with_custom_rows="$(seed_counts)"

run_seed

second_counts="$(seed_counts)"

[[ "$second_counts" == "$counts_with_custom_rows" ]] || {
  echo \
    "seed is not idempotent or changed custom rows: expected=$counts_with_custom_rows actual=$second_counts" \
    >&2
  exit 8
}

custom_relationships="$(
  query_scalar \
    "select count(*)
    from role_permissions rp
    join roles r on r.id = rp.role_id
    join permissions p on p.id = rp.permission_id
    where r.key = 'arena_test_custom'
      and p.key = 'arena.test.custom';"
)"

[[ "$custom_relationships" == 1 ]] || {
  echo "seed removed or changed the custom RBAC relationship" >&2
  exit 9
}

verify_email_memberships="$(
  query_scalar \
    "select count(*)
    from role_permissions rp
    join roles r on r.id = rp.role_id
    join permissions p on p.id = rp.permission_id
    where r.key = 'super_admin'
      and p.key = 'users.verify_email';"
)"

[[ "$verify_email_memberships" == 1 ]] || {
  echo "users.verify_email is not assigned exactly once to super_admin" >&2
  exit 10
}

drift_ruleset_id="$(
  query_scalar \
    "select gr.id
    from game_rulesets gr
    join games g on g.id = gr.game_id
    where g.slug = 'fc-26'
      and gr.status = 'ACTIVE'
    order by gr.version desc
    limit 1;"
)"

[[ "$drift_ruleset_id" =~ ^[0-9a-fA-F-]{36}$ ]] || {
  echo "active FC 26 ruleset was not found for drift validation" >&2
  exit 11
}

ruleset_count_before_drift="$(
  query_scalar "select count(*) from game_rulesets;"
)"

query_scalar \
  "update game_rulesets
  set
    configuration = '{\"arenaTestDrift\":true}'::jsonb,
    updated_at = now()
  where id = '$drift_ruleset_id'::uuid;"

if run_seed >"$log" 2>&1; then
  echo "Seed unexpectedly overwrote an existing FC 26 ruleset drift" >&2
  exit 12
else
  drift_rc=$?
fi

if ! grep -Eqi 'Fc26SeedDriftError|drift' "$log"; then
  echo "Seed failed after FC 26 drift, but did not report a drift error" >&2
  tail -c 16384 "$log" >&2
  exit 13
fi

drift_preserved="$(
  query_scalar \
    "select count(*)
    from game_rulesets
    where id = '$drift_ruleset_id'::uuid
      and configuration = '{\"arenaTestDrift\":true}'::jsonb;"
)"

[[ "$drift_preserved" == 1 ]] || {
  echo "Seed failure overwrote the drifted FC 26 configuration" >&2
  exit 14
}

ruleset_count_after_drift="$(
  query_scalar "select count(*) from game_rulesets;"
)"

[[ "$ruleset_count_after_drift" == "$ruleset_count_before_drift" ]] || {
  echo \
    "Seed failure changed the FC 26 ruleset count: before=$ruleset_count_before_drift after=$ruleset_count_after_drift" \
    >&2
  exit 15
}

printf \
  'seed disposable database validation passed: counts=%s drift_exit=%s\n' \
  "$second_counts" \
  "$drift_rc"
