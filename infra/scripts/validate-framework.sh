#!/usr/bin/env bash
set -Eeuo pipefail
root="$(cd -- "$(dirname -- "$0")/../.." && pwd -P)"; cd "$root"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
report="${VALIDATION_REPORT:-infra/validation-$timestamp.txt}"
failures=0; warnings=0
record() { printf '%s [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$1" "$2" | tee -a "$report"; }
run_required() {
  local label="$1"; shift
  if "$@" >>"$report" 2>&1; then record PASS "$label"; else record FAIL "$label"; failures=$((failures + 1)); fi
}
: >"$report"
while IFS= read -r -d '' file; do run_required "bash -n $file" bash -n "$file"; done < <(find infra/scripts -name '*.sh' -print0)
if command -v shellcheck >/dev/null 2>&1; then
  mapfile -d '' shell_files < <(find infra/scripts -name '*.sh' -print0)
  run_required ShellCheck shellcheck "${shell_files[@]}"
else record WARN "ShellCheck unavailable"; warnings=$((warnings + 1)); fi
run_required "automation tests" node --test infra/automation.test.mjs
run_required "project format" pnpm format:check
run_required "project tests" pnpm test
run_required "project checks" pnpm check
if command -v docker >/dev/null 2>&1; then
  run_required "Compose config" docker compose --env-file infra/tests/compose-validation.env \
    -f infra/compose/compose.base.yml -f infra/compose/compose.automation.staging.yml config --quiet
else record WARN "Compose config NOT EXECUTED - Docker unavailable"; warnings=$((warnings + 1)); fi
if grep -RInE 'git clean|git reset --hard|rm -rf|chmod 777|docker compose down -v|docker volume rm|docker system prune|curl.*\|.*(sh|bash)|wget.*\|.*(sh|bash)|eval|set -x|--privileged|network_mode:[[:space:]]*host|/var/run/docker.sock|0\.0\.0\.0:(5432|6379)' infra/scripts infra/compose; then
  record WARN "dangerous-pattern matches require contextual review"; warnings=$((warnings + 1))
else record PASS "dangerous executable pattern scan: no matches"; fi
if grep -RInE -- '-----BEGIN .*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|Bearer[[:space:]]+[A-Za-z0-9._-]{20,}' infra; then
  record FAIL "likely real secret detected"; failures=$((failures + 1))
else record PASS "high-confidence secret scan"; fi
record INFO "failures=$failures warnings=$warnings"
((failures == 0))
