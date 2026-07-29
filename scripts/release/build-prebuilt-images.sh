#!/usr/bin/env bash
set -Eeuo pipefail

: "${ARENA_REGISTRY:?ARENA_REGISTRY required, for example ghcr.io/owner}"
: "${ARENA_IMAGE_TAG:?ARENA_IMAGE_TAG required}"
: "${RELEASE_ID:?RELEASE_ID required}"
: "${SOURCE_COMMIT:?SOURCE_COMMIT required}"
ARENA_REGISTRY="${ARENA_REGISTRY,,}"
[[ "$ARENA_IMAGE_TAG" != latest ]] || { echo "latest is forbidden" >&2; exit 2; }
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "SOURCE_COMMIT must be a full Git SHA" >&2; exit 2; }
[[ "$ARENA_IMAGE_TAG" == "$SOURCE_COMMIT" || "$ARENA_IMAGE_TAG" == "$RELEASE_ID" ]] ||
  { echo "ARENA_IMAGE_TAG must equal SOURCE_COMMIT or RELEASE_ID" >&2; exit 2; }

output="${IMAGE_MANIFEST_OUTPUT:-deployment-images.json}"
records="$(mktemp)"
trap 'rm -f "$records"' EXIT

for service in migrate api worker web; do
  image="$ARENA_REGISTRY/arena-$service"
  tagged="$image:$ARENA_IMAGE_TAG"
  docker build \
    --file docker/Dockerfile \
    --target "$service" \
    --build-arg "BUILD_SHA=$SOURCE_COMMIT" \
    --build-arg "RELEASE_VERSION=$RELEASE_ID" \
    --tag "$tagged" .
  if [[ "$service" == migrate ]]; then
    bash scripts/release/validate-migration-image.sh "$tagged"
  fi
  docker push "$tagged"
  digest="$(docker buildx imagetools inspect "$tagged" --format '{{json .Manifest.Digest}}' | tr -d '"')"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "invalid digest for $service" >&2; exit 3; }
  printf '%s\t%s\t%s\t%s\n' "$service" "$image" "$ARENA_IMAGE_TAG" "$digest" >>"$records"
done

python3 - "$records" "$output" "$RELEASE_ID" "$SOURCE_COMMIT" <<'PY'
import datetime
import json
import sys

records, output, release_id, source_commit = sys.argv[1:]
images = {}
with open(records, encoding="utf-8") as source:
    for line in source:
        service, name, tag, digest = line.rstrip("\n").split("\t")
        images[service] = {
            "name": name,
            "tag": tag,
            "digest": digest,
            "reference": f"{name}:{tag}@{digest}",
        }
manifest = {
    "schemaVersion": 1,
    "releaseId": release_id,
    "sourceCommit": source_commit,
    "buildTimestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "images": images,
}
with open(output, "w", encoding="utf-8") as target:
    json.dump(manifest, target, indent=2)
    target.write("\n")
PY
printf 'wrote %s\n' "$output"
