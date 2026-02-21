#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://propnexus-backend-production.up.railway.app}"
BASE_URL="${BASE_URL%/}"

LOCATION="${LOCATION:-UB10}"
MAX_PAGES="${MAX_PAGES:-1}"

# Auth:
# - Provide IMPORT_ADMIN_TOKEN (preferred) or ADMIN_TOKEN
# - Or create a .admin_token file at repo root (auto-loaded)

if [[ -z "${IMPORT_ADMIN_TOKEN:-}" ]] && [[ -z "${ADMIN_TOKEN:-}" ]] && [[ -f ".admin_token" ]]; then
  IMPORT_ADMIN_TOKEN="$(cat .admin_token)"
  export IMPORT_ADMIN_TOKEN
fi

TOKEN="${IMPORT_ADMIN_TOKEN:-${ADMIN_TOKEN:-}}"
if [[ -z "${TOKEN:-}" ]]; then
  echo "ERROR: admin token not set. Use: export IMPORT_ADMIN_TOKEN=\"\$(cat .admin_token)\"" >&2
  exit 1
fi

pretty() {
  python - <<'PY'
import sys, json
try:
  print(json.dumps(json.load(sys.stdin), indent=2))
except Exception:
  print(sys.stdin.read())
PY
}

echo "== PropNexus Rightmove/Zoopla Debug Runner =="
echo "BASE_URL:   $BASE_URL"
echo "LOCATION:   $LOCATION"
echo "MAX_PAGES:  $MAX_PAGES"
echo

auth_headers=(
  -H "Authorization: Bearer $TOKEN"
  -H "x-admin-token: $TOKEN"
)

echo "---- 0) Backend health ----"
curl -sS "$BASE_URL/health" | pretty || true
echo

echo "---- 1) Probe Rightmove fetch ----"
curl -sS "$BASE_URL/debug/scrape-probe?source=rightmove&location=${LOCATION}" \
  "${auth_headers[@]}" | pretty
echo

echo "---- 2) Probe Zoopla fetch ----"
curl -sS "$BASE_URL/debug/scrape-probe?source=zoopla&location=${LOCATION}" \
  "${auth_headers[@]}" | pretty
echo

echo "---- 3) Import Rightmove ----"
curl -sS -X POST "$BASE_URL/import/rightmove" \
  -H "Content-Type: application/json" \
  "${auth_headers[@]}" \
  -d "{\"location\":\"${LOCATION}\"}" | pretty
echo

echo "---- 4) Import Zoopla ----"
curl -sS -X POST "$BASE_URL/import/zoopla?max_pages=${MAX_PAGES}" \
  -H "Content-Type: application/json" \
  "${auth_headers[@]}" \
  -d "{\"location\":\"${LOCATION}\"}" | pretty
echo

echo "---- 5) DB counts (sanity) ----"
curl -sS "$BASE_URL/debug/properties-count" \
  "${auth_headers[@]}" | pretty
echo
