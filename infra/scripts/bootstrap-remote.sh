#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib/common.sh"; source "$SCRIPT_DIR/lib/validation.sh"
[[ $# -eq 1 ]] || die "usage: $0 INVENTORY"
load_inventory "$1"
: "${SERVER_HOST:?SERVER_HOST required}"; : "${SERVER_INITIAL_USER:?SERVER_INITIAL_USER required}"
valid_user "$SERVER_INITIAL_USER" || die "invalid initial username"
bundle="$(mktemp -d)"; trap 'rm -rf -- "$bundle"' EXIT
tar --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='infra/secrets' -czf "$bundle/arena-bootstrap.tgz" -C "$REPO_ROOT" infra
info "password is never accepted by this script; SSH will prompt securely if key authentication is unavailable"
scp -P "$SERVER_SSH_PORT" "$bundle/arena-bootstrap.tgz" "$SERVER_INITIAL_USER@$SERVER_HOST:/tmp/arena-bootstrap.tgz"
ssh -p "$SERVER_SSH_PORT" -t "$SERVER_INITIAL_USER@$SERVER_HOST" 'umask 077; d=$(mktemp -d); tar -xzf /tmp/arena-bootstrap.tgz -C "$d"; echo "Run: sudo $d/infra/scripts/bootstrap.sh /path/to/operator-inventory"'
