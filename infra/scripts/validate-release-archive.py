#!/usr/bin/env python3
import hashlib
import json
import pathlib
import sys
import tarfile

archive, expected_version, expected_sha, expected_archive_sha = sys.argv[1:]
path = pathlib.Path(archive)
if path.name != f"arena-release-{expected_version}.tar.gz":
    raise SystemExit("release archive filename does not match RELEASE_VERSION")
actual_archive_sha = hashlib.sha256(path.read_bytes()).hexdigest()
if actual_archive_sha.lower() != expected_archive_sha.lower():
    raise SystemExit("release archive SHA-256 mismatch")
with tarfile.open(path, "r:gz") as bundle:
    members = bundle.getmembers()
    for member in members:
        member_path = pathlib.PurePosixPath(member.name)
        if member_path.is_absolute() or ".." in member_path.parts or member.issym() or member.islnk():
            raise SystemExit("release archive contains an unsafe member")
    def document(name):
        member = bundle.getmember(name)
        handle = bundle.extractfile(member)
        if handle is None:
            raise SystemExit(f"release archive member is unreadable: {name}")
        return json.load(handle)
    manifest = document("release/manifest.json")
    images = document("release/deployment-images.json")
if manifest.get("releaseVersion") != expected_version:
    raise SystemExit("release manifest version mismatch")
if manifest.get("buildSha") != expected_sha:
    raise SystemExit("release manifest build SHA mismatch")
if images.get("releaseId") != expected_version or images.get("sourceCommit") != expected_sha:
    raise SystemExit("deployment image manifest identity mismatch")
print(f"release={expected_version}\tbuild={expected_sha}\tarchiveSha256={actual_archive_sha}")
