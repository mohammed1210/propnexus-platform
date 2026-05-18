#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failures=0

pass() { printf 'PASS %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }

exists_any() {
  local path
  for path in "$@"; do
    [[ -e "$ROOT/$path" ]] && return 0
  done
  return 1
}

check_legal_pages() {
  exists_any "frontend/app/terms/page.tsx" "frontend/app/(legal)/terms/page.tsx" && pass "terms page exists" || fail "missing terms page"
  exists_any "frontend/app/privacy/page.tsx" "frontend/app/(legal)/privacy/page.tsx" && pass "privacy page exists" || fail "missing privacy page"
  exists_any "frontend/app/disclaimer/page.tsx" "frontend/app/(legal)/disclaimer/page.tsx" && pass "disclaimer page exists" || fail "missing disclaimer page"
}

check_footer_links() {
  local footer="$ROOT/frontend/components/Footer.tsx"
  if [[ ! -f "$footer" ]]; then
    warn "shared footer component not found"
    return
  fi

  grep -q 'href="/terms"' "$footer" && grep -q 'href="/privacy"' "$footer" && grep -q 'href="/disclaimer"' "$footer" \
    && pass "footer legal links found" \
    || warn "footer legal links may be missing"
}

check_client_secret_references() {
  local client_files
  client_files=$(grep -RIl "^['\"]use client['\"]" "$ROOT/frontend/app" "$ROOT/frontend/components" "$ROOT/frontend/lib" 2>/dev/null || true)

  if [[ -n "$client_files" ]] && grep -nE 'SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|OPENAI_API_KEY' $client_files >/tmp/propnexus-launch-client-secrets.txt 2>/dev/null; then
    fail "client-side frontend code references server secret env names"
  else
    pass "no server secret env names in client-side frontend code"
  fi

  if grep -RInE 'SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|OPENAI_API_KEY' "$ROOT/frontend/app/api" "$ROOT/frontend/lib" 2>/dev/null | grep -vE '/lib/legalCopy\.ts|\.bak\.' >/tmp/propnexus-launch-server-secret-refs.txt; then
    warn "server/API frontend files reference secret env names; verify they remain server-only"
  else
    pass "no server secret env names found in frontend server/API files"
  fi
}

check_visible_placeholders() {
  local matches
  matches=$(grep -RInE 'TODO|FIXME|lorem ipsum|coming soon|placeholder text' "$ROOT/frontend/app" "$ROOT/frontend/components" 2>/dev/null || true)
  if [[ -n "$matches" ]]; then
    warn "visible TODO/FIXME/placeholder-like strings found in frontend app/components"
    printf '%s\n' "$matches" | head -n 20
  else
    pass "no obvious visible TODO/FIXME/placeholder strings"
  fi
}

check_debug_routes() {
  local routes
  routes=$(find "$ROOT/frontend/app" "$ROOT/backend" -path '*node_modules*' -prune -o -type f | grep -Ei 'debug|diag|health|admin|test|seed|env|config' || true)
  if [[ -n "$routes" ]]; then
    warn "debug/diagnostic/admin/health-like files present; review production guards"
    printf '%s\n' "$routes" | sed "s#^$ROOT/##" | head -n 40
  else
    pass "no debug/diagnostic-like route files found"
  fi
}

check_scraperapi_launch_dependency() {
  if grep -RInE 'SCRAPERAPI_KEY=.*[^[:space:]]|SCRAPER_MODE=.*scraperapi|SCRAPER_PROVIDER=.*scraperapi' "$ROOT/scripts" "$ROOT/.github" "$ROOT/backend" 2>/dev/null | grep -vE '\.env\.example|\.env\.localcopy|migrations|docs|launch_audit\.sh' >/tmp/propnexus-launch-scraperapi.txt; then
    warn "ScraperAPI references exist in launch/runtime paths; confirm launch uses direct mode and fallback disabled"
  else
    pass "no ScraperAPI hard dependency detected in launch/runtime paths"
  fi
}

check_package_scripts() {
  grep -q '"build"' "$ROOT/package.json" && pass "root build script exists" || warn "root build script missing"
  grep -q '"lint"' "$ROOT/package.json" && pass "root lint script exists" || warn "root lint script missing"
  grep -q '"launch:audit"' "$ROOT/package.json" && pass "root launch:audit script exists" || warn "root launch:audit script missing"
  grep -q '"build"' "$ROOT/frontend/package.json" && pass "frontend build script exists" || warn "frontend build script missing"
  grep -q '"lint"' "$ROOT/frontend/package.json" && pass "frontend lint script exists" || warn "frontend lint script missing"
}

check_overconfident_wording() {
  if grep -RInEi 'guaranteed profit|guaranteed return' "$ROOT/frontend/app" "$ROOT/frontend/components" "$ROOT/frontend/lib" "$ROOT/docs" 2>/dev/null >/tmp/propnexus-launch-guarantees.txt; then
    fail "obvious guaranteed profit/return wording found"
  else
    pass "no obvious guaranteed profit/return wording"
  fi
}

check_legal_pages
check_footer_links
check_client_secret_references
check_visible_placeholders
check_debug_routes
check_scraperapi_launch_dependency
check_package_scripts
check_overconfident_wording

if (( failures > 0 )); then
  printf 'FAIL launch audit found %s blocker(s)\n' "$failures"
  exit 1
fi

pass "launch audit completed without hard blockers"
