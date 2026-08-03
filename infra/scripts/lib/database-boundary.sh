#!/usr/bin/env bash
set -Eeuo pipefail

is_private_ipv4() {
  local address="${1:?IPv4 address required}"

  [[ "$address" =~ ^10\. ]] ||
    [[ "$address" =~ ^127\. ]] ||
    [[ "$address" =~ ^169\.254\. ]] ||
    [[ "$address" =~ ^192\.168\. ]] ||
    [[ "$address" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]]
}

is_private_ipv6() {
  local address="${1,,}"

  [[ "$address" == "::1" ]] ||
    [[ "$address" == fe80:* ]] ||
    [[ "$address" == fc* ]] ||
    [[ "$address" == fd* ]]
}

postgres_listener_addresses() {
  ss -H -lnt |
    awk '
      {
        local_address = $4
        if (local_address ~ /:5432$/) {
          sub(/:5432$/, "", local_address)
          gsub(/^\[/, "", local_address)
          gsub(/\]$/, "", local_address)
          print local_address
        }
      }
    ' |
    sort -u
}

verify_external_postgres_boundary() {
  local address
  local found=false
  local unsafe=false

  while IFS= read -r address; do
    [[ -n "$address" ]] || continue
    found=true

    case "$address" in
      0.0.0.0 | "*" | "::")
        warn "external PostgreSQL uses a wildcard listener: $address:5432"
        unsafe=true
        ;;

      *:*)
        if ! is_private_ipv6 "$address"; then
          warn "external PostgreSQL listens on a non-private IPv6 address: [$address]:5432"
          unsafe=true
        fi
        ;;

      *)
        if ! is_private_ipv4 "$address"; then
          warn "external PostgreSQL listens on a non-private IPv4 address: $address:5432"
          unsafe=true
        fi
        ;;
    esac
  done < <(postgres_listener_addresses)

  if [[ "$found" != true ]]; then
    warn "external PostgreSQL has no TCP listener on port 5432"
    return 1
  fi

  [[ "$unsafe" != true ]]
}
