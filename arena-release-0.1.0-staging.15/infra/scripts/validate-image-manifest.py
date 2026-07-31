#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

SERVICES = ("migrate", "api", "worker", "web", "seed")
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
REFERENCE = re.compile(
    r"^(?P<name>[a-z0-9][a-z0-9._/-]*):(?P<tag>[A-Za-z0-9][A-Za-z0-9._-]*)"
    r"(?:@(?P<digest>sha256:[0-9a-f]{64}))?$"
)


def fail(message: str) -> None:
    raise SystemExit(f"invalid deployment image manifest: {message}")


if len(sys.argv) not in (3, 4):
    raise SystemExit(
        "usage: validate-image-manifest.py MANIFEST RELEASE_ID [EXPECTED_SOURCE_COMMIT]"
    )

path = Path(sys.argv[1])
if not path.is_file() or path.is_symlink():
    fail("manifest must be a regular, non-symlink file")

try:
    manifest = json.loads(path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as error:
    fail(str(error))

if manifest.get("schemaVersion") != 1:
    fail("schemaVersion must be 1")
if manifest.get("releaseId") != sys.argv[2]:
    fail("releaseId does not match RELEASE_VERSION")
if not COMMIT.fullmatch(str(manifest.get("sourceCommit", ""))):
    fail("sourceCommit must be a full lowercase Git SHA")
if len(sys.argv) == 4 and manifest["sourceCommit"] != sys.argv[3]:
    fail("sourceCommit does not match BUILD_SHA")
if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", str(manifest.get("buildTimestamp", ""))):
    fail("buildTimestamp must be UTC ISO-8601")

images = manifest.get("images")
if not isinstance(images, dict) or set(images) != set(SERVICES):
    fail("images must contain exactly migrate, api, worker, web, and seed")

repository_prefix = None
for service in SERVICES:
    image = images[service]
    if not isinstance(image, dict):
        fail(f"{service} must be an object")
    required = {"name", "tag", "digest", "reference"}
    if set(image) != required:
        fail(f"{service} must contain exactly name, tag, digest, and reference")
    if str(image["tag"]).lower() == "latest":
        fail(f"{service} uses forbidden latest tag")
    if image["tag"] not in (manifest["sourceCommit"], manifest["releaseId"]):
        fail(f"{service} tag is mutable or does not identify this release")
    if not DIGEST.fullmatch(str(image["digest"])):
        fail(f"{service} digest is invalid")
    match = REFERENCE.fullmatch(str(image["reference"]))
    if not match:
        fail(f"{service} reference is invalid")
    if match.group("name") != image["name"] or match.group("tag") != image["tag"]:
        fail(f"{service} reference does not match name/tag")
    if match.group("digest") != image["digest"]:
        fail(f"{service} reference must retain its digest")
    suffix = f"/arena-{service}"
    if not str(image["name"]).endswith(suffix):
        fail(f"{service} repository is invalid")
    service_prefix = str(image["name"])[: -len(suffix)]
    if not service_prefix:
        fail(f"{service} repository namespace is missing")
    if repository_prefix is None:
        repository_prefix = service_prefix
    elif service_prefix != repository_prefix:
        fail(f"{service} repository namespace does not match")
    print(f"{service}\t{image['reference']}")
