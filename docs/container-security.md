# Container security

Runtime images use a fixed unprivileged UID/GID (`10001`), Debian slim, compiled output, and
read-only application filesystems. Compose drops all Linux capabilities, enables
`no-new-privileges`, limits writable tmpfs paths, initializes signal forwarding, rotates local
JSON logs, and bounds resources.

Forbidden deployment changes include privileged mode, host networking/PID/IPC, device access,
Docker socket mounts, mutable image tags, development commands, and migration or seed chaining in
application startup. Logs remain on stdout/stderr and must not contain environment dumps,
credentials, authorization headers, cookies, or database URLs.

The checked-in base image version is exact but not digest-pinned because an authoritative digest
could not be resolved in this environment. Release engineering must resolve the correct
architecture/manifest digest, review upstream changes, and update the Dockerfile and manifest
together. CI builds images but does not authenticate, push, deploy, or provision infrastructure.

Run an approved image and SBOM scanner after building. Vulnerability scanning is not represented
as successful when Docker/scanning tooling is unavailable.

# F10 runtime requirement

F9.4 statically verifies pinned multi-stage non-root targets and hardened Compose configuration.
Image build, runtime inspection, and vulnerability scanning remain mandatory F10 checks.
