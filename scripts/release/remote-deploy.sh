#!/usr/bin/env bash
set -Eeuo pipefail

ARCHIVE="${1:?archive path required}"
VERSION="${2:?release version required}"
ARCHIVE_SHA256="${3:?archive SHA256 required}"

APP_ROOT="/opt/arena"
RELEASES_ROOT="$APP_ROOT/releases"
RELEASE_DIR="$RELEASES_ROOT/$VERSION"
INVENTORY="$APP_ROOT/shared/env/production-$VERSION.env"
WORKDIR="/tmp/arena-deploy-$VERSION"

log() {
  printf '\n[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  rm -rf "$WORKDIR"
  sudo rm -rf "$RELEASES_ROOT/.${VERSION}.incoming."* 2>/dev/null || true
  rm -f /tmp/remote-deploy.sh 2>/dev/null || true
}

trap cleanup EXIT

log "Checking uploaded archive"

[[ -f "$ARCHIVE" ]] ||
  fail "archive not found: $ARCHIVE"

[[ ! -L "$ARCHIVE" ]] ||
  fail "archive must not be a symbolic link"

ACTUAL_SHA256="$(sha256sum "$ARCHIVE" | awk '{print $1}')"

if [[ "${ACTUAL_SHA256,,}" != "${ARCHIVE_SHA256,,}" ]]; then
  fail "archive checksum mismatch; expected=$ARCHIVE_SHA256 actual=$ACTUAL_SHA256"
fi

tar -tzf "$ARCHIVE" >/dev/null

log "Checking production inventory"

sudo test -f "$INVENTORY" ||
  fail "inventory missing or inaccessible: $INVENTORY"

log "Preparing installer workspace"

rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

tar \
  -xzf "$ARCHIVE" \
  -C "$WORKDIR" \
  --no-same-owner \
  --no-same-permissions

[[ -f "$WORKDIR/release/manifest.json" ]] ||
  fail "release manifest missing"

[[ -x "$WORKDIR/infra/scripts/install-release.sh" ]] ||
  fail "install-release.sh missing"

BUILD_SHA="$(jq -r '.buildSha // empty' "$WORKDIR/release/manifest.json")"

[[ "$BUILD_SHA" =~ ^[0-9a-fA-F]{40}$ ]] ||
  fail "invalid build SHA in release manifest"

if sudo test -f "$RELEASE_DIR/release/manifest.json"; then
  INSTALLED_BUILD_SHA="$(
    sudo jq -r '.buildSha // empty' \
      "$RELEASE_DIR/release/manifest.json"
  )"

  if [[ "$INSTALLED_BUILD_SHA" != "$BUILD_SHA" ]]; then
    fail "release directory already exists with a different build SHA"
  fi

  log "Immutable release already installed; skipping installation"
else
  log "Installing immutable release"

  sudo env \
    RELEASE_ARCHIVE="$ARCHIVE" \
    RELEASE_ARCHIVE_SHA256="$ARCHIVE_SHA256" \
    RELEASE_VERSION="$VERSION" \
    BUILD_SHA="$BUILD_SHA" \
    bash "$WORKDIR/infra/scripts/install-release.sh" \
    "$INVENTORY"
fi

sudo test -f "$RELEASE_DIR/release/manifest.json" ||
  fail "installed release manifest missing"

log "Deploying release through official deployment script"

sudo env \
  RELEASE_ARCHIVE="$ARCHIVE" \
  RELEASE_ARCHIVE_SHA256="$ARCHIVE_SHA256" \
  RELEASE_VERSION="$VERSION" \
  BUILD_SHA="$BUILD_SHA" \
  bash "$RELEASE_DIR/infra/scripts/deploy.sh" \
  "$INVENTORY"

# deploy.sh خودش migration، readiness و verify را انجام می‌دهد.
# اجرای دوباره verify.sh عمداً حذف شده است.

log "Active release"

readlink -f "$APP_ROOT/current"

log "Running containers"

sudo docker ps \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

log "Deployment completed successfully"