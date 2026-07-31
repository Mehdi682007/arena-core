#!/usr/bin/env bash
set -Eeuo pipefail

[[ $# -eq 1 ]] || {
  echo "usage: $0 SEED_IMAGE" >&2
  exit 2
}
seed_image="$1"
registry="arena-seed-contract-registry-$$"
project="arena-seed-contract-$$"
work="$(mktemp -d)"

cleanup() {
  docker compose --project-name "$project" --project-directory . \
    -f infra/compose/compose.base.yml \
    -f infra/compose/compose.automation.staging.yml \
    --profile seed down --remove-orphans >/dev/null 2>&1 || true
  docker rm -f "$registry" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

docker run -d --name "$registry" -p 127.0.0.1:5000:5000 registry:2 >/dev/null
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:5000/v2/ >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:5000/v2/ >/dev/null

tagged="localhost:5000/arena-seed:contract"
docker tag "$seed_image" "$tagged"
docker push "$tagged" >/dev/null
repo_digest="$(
  docker image inspect "$tagged" --format '{{index .RepoDigests 0}}'
)"
[[ "$repo_digest" == localhost:5000/arena-seed@sha256:* ]]
immutable="$tagged@${repo_digest##*@}"

touch "$work/runtime.env"
printf 'test-only\n' >"$work/POSTGRES_PASSWORD"
chmod 0600 "$work/POSTGRES_PASSWORD"
export ARENA_ENV_FILE="$work/runtime.env"
export ARENA_SECRETS_DIR="$work"
export POSTGRES_DB=arena_contract
export POSTGRES_USER=arena
export ARENA_MIGRATE_IMAGE="$immutable"
export ARENA_API_IMAGE="$immutable"
export ARENA_WORKER_IMAGE="$immutable"
export ARENA_WEB_IMAGE="$immutable"
export ARENA_SEED_IMAGE="$immutable"

compose_args=(
  --project-name "$project"
  --project-directory .
  -f infra/compose/compose.base.yml
  -f infra/compose/compose.automation.staging.yml
  --profile seed
)
docker compose "${compose_args[@]}" config --format json |
  python3 infra/scripts/validate-seed-compose.py "$immutable"
docker compose "${compose_args[@]}" create --no-build arena-seed >/dev/null
container="$(docker compose "${compose_args[@]}" ps --all -q arena-seed)"
[[ -n "$container" ]]

python3 - "$container" "$immutable" <<'PY'
import json
import subprocess
import sys

container, expected_image = sys.argv[1:]
data = json.loads(
    subprocess.check_output(["docker", "inspect", container], text=True)
)[0]
if data["Config"]["User"] != "10001:10001":
    raise SystemExit("runtime user mismatch")
if data["HostConfig"]["ReadonlyRootfs"] is not True:
    raise SystemExit("read-only root filesystem missing")
if data["HostConfig"]["Privileged"] is not False:
    raise SystemExit("privileged mode enabled")
tmpfs = data["HostConfig"].get("Tmpfs") or {}
options = set((tmpfs.get("/tmp") or "").split(","))
size_options = {option for option in options if option.startswith("size=")}
if (
    options - size_options != {"rw", "noexec", "nosuid"}
    or size_options not in ({"size=64m"}, {"size=67108864"})
):
    raise SystemExit(f"tmpfs mismatch: {tmpfs!r}")
if data["Config"]["Image"] != expected_image:
    raise SystemExit("immutable image reference mismatch")
for mount in data.get("Mounts", []):
    if mount.get("Destination") == "/app" or "docker.sock" in mount.get("Destination", ""):
        raise SystemExit("forbidden writable mount")
PY

printf 'tracked Seed Compose container contract validated: image=%s\n' "$immutable"
