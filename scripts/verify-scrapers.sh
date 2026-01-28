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
  local max_pages="${3:-}"
  echo "---- import: $source ($location) ----"

  local url="$BACKEND_URL/import/$source"
  # Zoopla + OnTheMarket support max_pages query param.
  if [[ -n "$max_pages" ]] && [[ "$source" == "zoopla" || "$source" == "onthemarket" ]]; then
    url="$url?max_pages=$max_pages"
  fi

  local attempt
  for attempt in 1 2 3; do
    local out
    out=$(curl -sS -X POST "$url" \
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

run_batch_import() {
  local cities_csv="$1"
  local max_pages="$2"
  local run_async="${3:-1}"
  echo "---- import: batch (cities=$cities_csv, max_pages=$max_pages) ----"

  local run_async_json="false"
  if [[ "$run_async" == "1" ]]; then
    run_async_json="true"
  fi

  local attempt
  for attempt in 1 2 3; do
    local payload
    payload="{\"cities\":[\"$(echo "$cities_csv" | sed 's/,/\",\"/g')\"],\"max_pages\":${max_pages},\"delay_min_s\":0.5,\"delay_max_s\":1.5"
    if [[ "$run_async_json" == "true" ]]; then
      payload+=" ,\"run_async\":true"
    fi
    payload+="}"

    local out curl_rc
    set +e
    out=$(curl --http1.1 -sS -w "\n__HTTP_STATUS__:%{http_code}" -X POST "$BACKEND_URL/import/batch" \
      -H "x-admin-token: $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$payload")
    curl_rc=$?
    set -e

    local http_status body
    http_status="${out##*__HTTP_STATUS__:}"
    body="${out%__HTTP_STATUS__:*}"

    if [[ "$curl_rc" != "0" || "$http_status" == "000" ]]; then
      if [[ "$attempt" -lt 3 ]]; then
        echo "(batch retry $attempt/3 due to curl/http error)" >&2
        sleep_retry 3
        continue
      fi
      fail "Batch import failed (curl/http error)"
    fi

    printf '%s\n' "$body" | json_head 160 || true

    if [[ "$http_status" != "200" ]]; then
      # Deployed API may not yet support run_async; fall back once.
      if [[ "$http_status" == "422" && "$run_async_json" == "true" ]]; then
        echo "(batch 422; retrying without run_async)" >&2
        run_async_json="false"
        if [[ "$attempt" -lt 3 ]]; then
          sleep_retry 1
          continue
        fi
      fi
      if [[ "$http_status" == "404" ]]; then
        fail "Batch import endpoint not deployed at $BACKEND_URL/import/batch (HTTP 404)"
      fi
      fail "Batch import failed (HTTP $http_status)"
    fi

    if ! printf '%s' "$body" | python3 -c 'import json,sys
try:
  j=json.load(sys.stdin)
  cities=j.get("cities") or []
  max_pages=int(j.get("max_pages") or 0)
  queued=bool(j.get("queued"))
  per_city=j.get("per_city")
  run_ids=j.get("run_ids")
  batch_id=j.get("batch_id")
  status_url=j.get("status_url")

  print("parsed_cities:", len(cities))
  print("parsed_max_pages:", max_pages)
  print("parsed_queued:", queued)
  if isinstance(per_city, dict):
    print("parsed_per_city_keys:", len(per_city.keys()))
  if isinstance(run_ids, dict):
    print("parsed_run_ids_keys:", len(run_ids.keys()))

  # Async mode returns either:
  # - {queued:true, batch_id:"...", status_url:"/import/batch/status/..."} (new)
  # - {queued:true, run_ids:{city: run_id}} (legacy)
  if queued:
    ok=(len(cities)>=1 and max_pages>=1 and ((isinstance(batch_id,str) and batch_id and isinstance(status_url,str) and status_url) or (isinstance(run_ids, dict) and len(run_ids.keys())==len(cities))))
  else:
    # Sync mode returns {total_scraped, total_imported, per_city}
    ok=(len(cities)>=1 and max_pages>=1 and isinstance(per_city, dict))
  sys.exit(0 if ok else 1)
except Exception as e:
  print("batch_json_parse_error:", e)
  sys.exit(1)
'; then
      if [[ "$attempt" -lt 3 ]]; then
        echo "(batch retry $attempt/3 due to parse error)" >&2
        sleep_retry 2
        continue
      fi
      fail "Batch import failed (bad JSON or missing fields)"
    fi

    return 0
  done
}

echo "=============================================="
echo " PropNexus Scrapers Sprint Verification Runner "
echo "=============================================="

check_health

VERIFY_MAX_PAGES="${VERIFY_MAX_PAGES:-2}"
# Comma-separated list override, e.g. VERIFY_CITIES='London,Birmingham,Manchester'
VERIFY_CITIES="${VERIFY_CITIES:-London,Birmingham,Manchester}"
VERIFY_RUN_BATCH="${VERIFY_RUN_BATCH:-0}"
VERIFY_BATCH_ASYNC="${VERIFY_BATCH_ASYNC:-1}"

IFS=',' read -r -a CITIES <<< "$VERIFY_CITIES"
if [[ "${#CITIES[@]}" -lt 3 ]]; then
  fail "VERIFY_CITIES must include at least 3 cities"
fi

echo "---- config ----"
echo "VERIFY_MAX_PAGES=$VERIFY_MAX_PAGES"
echo "VERIFY_CITIES=$VERIFY_CITIES"
echo "VERIFY_RUN_BATCH=$VERIFY_RUN_BATCH"
echo "VERIFY_BATCH_ASYNC=$VERIFY_BATCH_ASYNC"

for city in "${CITIES[@]}"; do
  city="$(echo "$city" | xargs)"
  [[ -n "$city" ]] || continue
  probe_source "zoopla"      "$city" 0
  probe_source "onthemarket" "$city" 0
done

for city in "${CITIES[@]}"; do
  city="$(echo "$city" | xargs)"
  [[ -n "$city" ]] || continue
  run_import "zoopla"      "$city" "$VERIFY_MAX_PAGES"
  run_import "onthemarket" "$city" "$VERIFY_MAX_PAGES"
done

if [[ "$VERIFY_RUN_BATCH" == "1" ]]; then
  # Keep it bounded + quick: use the first 3 cities.
  batch_cities="${CITIES[0]},${CITIES[1]},${CITIES[2]}"
  run_batch_import "$batch_cities" "$VERIFY_MAX_PAGES" "$VERIFY_BATCH_ASYNC"
fi

check_latest_rows "zoopla" 5
check_latest_rows "onthemarket" 5

C_ZP=$(count_rows "zoopla")
C_OT=$(count_rows "onthemarket")

echo "---- counts (<=200 fetched) ----"
echo "zoopla:      $C_ZP"
echo "onthemarket: $C_OT"

[[ "$C_ZP" -gt 0 ]] && pass "Zoopla rows present" || fail "No Zoopla rows returned"
[[ "$C_OT" -gt 0 ]] && pass "OnTheMarket rows present" || fail "No OnTheMarket rows returned"

echo
echo "=============================================="
echo " ✅ SCRAPERS SPRINT VERIFIED: ALL SOURCES OK "
echo "=============================================="
