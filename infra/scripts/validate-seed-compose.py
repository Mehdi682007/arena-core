#!/usr/bin/env python3
import json
import sys

APPROVED_TMPFS = ["/tmp:rw,noexec,nosuid,size=64m"]
APPROVED_NETWORKS = {"app", "data"}


def fail(message: str) -> None:
    raise SystemExit(f"Seed Compose contract invalid: {message}")


if len(sys.argv) != 2:
    fail("expected immutable Seed image argument")
expected_image = sys.argv[1]
if "@sha256:" not in expected_image or ":latest@" in expected_image:
    fail("expected image is not immutable")

document = json.load(sys.stdin)
service = document.get("services", {}).get("arena-seed")
if not isinstance(service, dict):
    fail("arena-seed service missing")
if service.get("image") != expected_image:
    fail("image does not match ARENA_SEED_IMAGE")
if service.get("user") != "10001:10001":
    fail("user must be 10001:10001")
if service.get("read_only") is not True:
    fail("root filesystem must be read-only")
if service.get("tmpfs") != APPROVED_TMPFS:
    fail("tmpfs must be exactly /tmp:rw,noexec,nosuid,size=64m")
if service.get("privileged") is True:
    fail("privileged mode is forbidden")
if service.get("entrypoint") is not None or service.get("command") is not None:
    fail("Compose must not override the immutable image entrypoint or command")
if set(service.get("networks", {})) != APPROVED_NETWORKS:
    fail("Seed networks must remain app and data")
for mount in service.get("volumes", []):
    target = mount.get("target", "") if isinstance(mount, dict) else str(mount)
    source = mount.get("source", "") if isinstance(mount, dict) else str(mount)
    if target == "/app" or "docker.sock" in target or "docker.sock" in source:
        fail("writable application or Docker socket mount is forbidden")

print("Seed Compose contract validated.")
