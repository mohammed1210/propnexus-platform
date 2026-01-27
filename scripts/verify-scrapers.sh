#!/usr/bin/env bash
# === PropNexus Scrapers Sprint Verification (NO rg dependency) ===
set -euo pipefail

export BACKEND_URL="${BACKEND_URL:-https://propnexus-backend-production.up.railway.app}"

if [[ -f ".admin_token" ]]; then
  export ADMIN_TOKEN="${ADMIN_TOKEN:-$(cat .admin_token)}"
else
  echo "ERROR: .admin_token not found. Create it or export ADMIN_TOKEN."
  exit 1
fi

echo "BACKEND_URL=$BACKEND_URL"
echo "ADMIN_TOKEN=<set>"

pass() { echo "✅ $*"; }
fail() { echo "❌ $*"; exit 1; }

sleep_retry() {
  local seconds="$1"
  sleep "$seconds"
}

# Reads full stdin first (so upstream curl can finish), then pretty-prints JSON and
# prints only the first N lines. This avoids broken-pipe failures under pipefail.
json_head() {
  local lines="${1:-80}"
  python3 -c 'import json,sys
max_lines=int(sys.argv[1])
raw=sys.stdin.read()
out=raw
try:
  if raw.strip():
    out=json.dumps(json.loads(raw), indent=2, ensure_ascii=False)
except Exception:
  out=raw
lines=out.splitlines()
print("\n".join(lines[:max_lines]))
' "$lines"
}

check_health() {
  echo "---- /health ----"
  local attempt
  for attempt in 1 2 3; do
    local h
    h=$(curl -sS "$BACKEND_URL/health" || true)
    echo "$h"

    if printf '%s' "$h" | python3 -c 'import json,sys
try:
  j=json.load(sys.stdin)
  ok=(j.get("status")=="ok")
  print("parsed_status:", j.get("status"))
  sys.exit(0 if ok else 1)
except Exception as e:
  print("health_json_parse_error:", e)
  sys.exit(1)
'; then
      pass "Backend health OK"
      return 0
    fi

    if [[ "$attempt" -lt 3 ]]; then
      echo "(health retry $attempt/3)" >&2
      sleep_retry 2
    fi
  done

  fail "Backend health NOT OK"
}

probe_source() {
  local source="$1"
  local location="$2"
  local page="${3:-0}"
  echo "---- scrape-probe: $source ($location) ----"

  set +e
  curl -sS "$BACKEND_URL/debug/scrape-probe?location=${location}&sources=${source}&page=${page}" \
    -H "x-admin-token: $ADMIN_TOKEN" | json_head 120
  set -e
}

run_import() {
  local source="$1"
  local location="$2"
  echo "---- import: $source ($location) ----"

  local attempt
  for attempt in 1 2 3; do
    local out
    out=$(curl -sS -X POST "$BACKEND_URL/import/$source" \
      -H "x-admin-token: $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"location\":\"${location}\"}" || true)

    printf '%s\n' "$out" | json_head 120 || true

    if printf '%s' "$out" | python3 -c 'import json,sys
try:
  j=json.load(sys.stdin)
  count=int(j.get("count") or 0)
  upsert_ok=bool(j.get("db_upsert_ok"))
  print("parsed_count:", count)
  print("parsed_db_upsert_ok:", upsert_ok)
  sys.exit(0 if (count>0 and upsert_ok) else 1)
except Exception as e:
  print("import_json_parse_error:", e)
  sys.exit(1)
'; then
      return 0
    fi

    if [[ "$attempt" -lt 3 ]]; then
      echo "(import retry $attempt/3 for $source)" >&2
      sleep_retry 3
    fi
  done

  fail "Import failed for source=$source (count==0 or upsert failed)"
}

check_latest_rows() {
  local source="$1"
  local limit="${2:-5}"
  echo "---- verify rows: source=$source (limit=$limit) ----"

  set +e
  curl -sS "$BACKEND_URL/properties?source=${source}&sort=created_at&dir=desc&limit=${limit}" | json_head 120
  set -e
}

count_rows() {
  local source="$1"
  curl -sS "$BACKEND_URL/properties?source=${source}&limit=200" | python3 -c 'import json,sys
try:
  arr=json.load(sys.stdin)
  print(len(arr))
except Exception:
  print(0)
'
}

echo "=============================================="
echo " PropNexus Scrapers Sprint Verification Runner "
echo "=============================================="

check_health

LOC_SPAREROOM="Birmingham"
LOC_ZOOPLA="London"
LOC_OTM="London"

probe_source "spareroom"   "$LOC_SPAREROOM" 0
probe_source "zoopla"      "$LOC_ZOOPLA" 0
probe_source "onthemarket" "$LOC_OTM" 0

run_import "spareroom"   "$LOC_SPAREROOM"
run_import "zoopla"      "$LOC_ZOOPLA"
run_import "onthemarket" "$LOC_OTM"

check_latest_rows "spareroom" 5
check_latest_rows "zoopla" 5
check_latest_rows "onthemarket" 5

C_SR=$(count_rows "spareroom")
C_ZP=$(count_rows "zoopla")
C_OT=$(count_rows "onthemarket")

echo "---- counts (<=200 fetched) ----"
echo "spareroom:   $C_SR"
echo "zoopla:      $C_ZP"
echo "onthemarket: $C_OT"

[[ "$C_SR" -gt 0 ]] && pass "SpareRoom rows present" || fail "No SpareRoom rows returned"
[[ "$C_ZP" -gt 0 ]] && pass "Zoopla rows present" || fail "No Zoopla rows returned"
[[ "$C_OT" -gt 0 ]] && pass "OnTheMarket rows present" || fail "No OnTheMarket rows returned"

echo
echo "=============================================="
echo " ✅ SCRAPERS SPRINT VERIFIED: ALL SOURCES OK "
echo "=============================================="
