#!/usr/bin/env bash
set -Eeuo pipefail

valid_bool() { [[ "$1" == true || "$1" == false ]]; }
valid_user() { [[ "$1" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]]; }
valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && ((10#$1 >= 1 && 10#$1 <= 65535)); }
valid_abs_path() {
  [[ "$1" == /* && "$1" != "/" && "$1" != *".."* && "$1" != *$'\n'* && "$1" != *$'\r'* ]]
}
load_inventory() {
  INVENTORY_FILE="${1:?inventory path required}"
  [[ -f "$INVENTORY_FILE" ]] || die "inventory not found: $INVENTORY_FILE"
  [[ ! -L "$INVENTORY_FILE" ]] || die "inventory must not be a symlink"
  set -a
  # shellcheck disable=SC1090
  source "$INVENTORY_FILE"
  set +a
  : "${ENVIRONMENT:?ENVIRONMENT required}"
  : "${SERVER_SSH_PORT:?SERVER_SSH_PORT required}"
  : "${SERVER_OPERATOR_USER:?SERVER_OPERATOR_USER required}"
  : "${SERVER_APP_USER:?SERVER_APP_USER required}"
  : "${SERVER_APP_ROOT:?SERVER_APP_ROOT required}"
  : "${SERVER_BACKUP_ROOT:?SERVER_BACKUP_ROOT required}"
  : "${DEPLOY_MODE:?DEPLOY_MODE required}"
  [[ "$ENVIRONMENT" == staging || "$ENVIRONMENT" == production ]] || die "invalid ENVIRONMENT"
  valid_port "$SERVER_SSH_PORT" || die "invalid SSH port"
  valid_user "$SERVER_OPERATOR_USER" || die "invalid operator username"
  valid_user "$SERVER_APP_USER" || die "invalid runtime username"
  [[ "$SERVER_OPERATOR_USER" != "$SERVER_APP_USER" ]] || die "operator and runtime users must differ"
  valid_abs_path "$SERVER_APP_ROOT" || die "unsafe app root"
  valid_abs_path "$SERVER_BACKUP_ROOT" || die "unsafe backup root"
  for key in ENABLE_TLS ENABLE_UFW ENABLE_FAIL2BAN ENABLE_UNATTENDED_UPDATES ENABLE_SWAP SSH_ALLOW_TCP_FORWARDING OPERATOR_DOCKER_GROUP; do
    valid_bool "${!key}" || die "$key must be true or false"
  done
  [[ "${POSTGRES_MODE:-}" == container || "${POSTGRES_MODE:-}" == external ]] || die "invalid POSTGRES_MODE"
  [[ "$DEPLOY_MODE" == prebuilt || "$DEPLOY_MODE" == build-local ]] || die "invalid DEPLOY_MODE"
  INVENTORY_BUILD_SHA="${BUILD_SHA:-}"
  export INVENTORY_BUILD_SHA
  if [[ -n "${RELEASE_ARCHIVE:-}" ]]; then
    valid_abs_path "$RELEASE_ARCHIVE" || die "unsafe RELEASE_ARCHIVE"
    [[ "${RELEASE_ARCHIVE_SHA256:-}" =~ ^[0-9a-fA-F]{64}$ ]] || die "RELEASE_ARCHIVE_SHA256 required for release archive"
  fi
  valid_bool "${SMTP_ENABLED:-false}" || die "SMTP_ENABLED must be true or false"
  if [[ "${SMTP_ENABLED:-false}" == true ]]; then
    : "${SMTP_HOST:?SMTP_HOST required when SMTP is enabled}"
    : "${SMTP_PORT:?SMTP_PORT required when SMTP is enabled}"
    : "${SMTP_SECURE:?SMTP_SECURE required when SMTP is enabled}"
    : "${SMTP_USERNAME:?SMTP_USERNAME required when SMTP is enabled}"
    : "${SMTP_FROM_ADDRESS:?SMTP_FROM_ADDRESS required when SMTP is enabled}"
    valid_port "$SMTP_PORT" || die "invalid SMTP_PORT"
    valid_bool "$SMTP_SECURE" || die "SMTP_SECURE must be true or false"
  fi
  if [[ -n "${REGISTRY_USERNAME:-}" || -n "${REGISTRY_TOKEN_FILE:-}" ]]; then
    [[ -n "${REGISTRY_USERNAME:-}" && -n "${REGISTRY_TOKEN_FILE:-}" ]] ||
      die "REGISTRY_USERNAME and REGISTRY_TOKEN_FILE must be configured together"
    valid_abs_path "$REGISTRY_TOKEN_FILE" || die "unsafe REGISTRY_TOKEN_FILE"
  fi
  if [[ "$ENVIRONMENT" == production ]]; then
    [[ -n "${APP_DOMAIN:-}" ]] || die "APP_DOMAIN required in production"
    [[ -n "${ADMIN_DOMAIN:-}" ]] || die "ADMIN_DOMAIN required in production"
    [[ "$ADMIN_DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ && "$ADMIN_DOMAIN" != *"*"* ]] ||
      die "invalid ADMIN_DOMAIN"
    [[ "$ADMIN_DOMAIN" != "$APP_DOMAIN" ]] || die "ADMIN_DOMAIN must differ from APP_DOMAIN"
    [[ "$ENABLE_TLS" == true ]] || die "TLS required in production inventory"
  fi
}
parse_common_args() {
  [[ $# -ge 1 ]] || die "usage: $0 INVENTORY [--dry-run]"
  load_inventory "$1"; shift
  while (($#)); do
    case "$1" in --dry-run) DRY_RUN=true ;; *) die "unknown argument: $1" ;; esac
    shift
  done
}
