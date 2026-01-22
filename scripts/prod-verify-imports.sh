#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-https://propnexus-backend-production.up.railway.app}"
LOCATION="${LOCATION:-London}"
SOURCES="${SOURCES:-zoopla,rightmove,onthemarket,spareroom}"
PAGE="${PAGE:-0}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-60}"

cd "$(dirname "$0")/.."

# ---- Load ADMIN_TOKEN from repo file (do NOT echo it) ----
if [ ! -f .admin_token ]; then
  echo "❌ Missing .admin_token in repo root. Create it with your admin token (no newline ideally)."
  exit 1
fi
ADMIN_TOKEN="$(tr -d '\n' < .admin_token)"
if [ ${#ADMIN_TOKEN} -lt 20 ]; then
  echo "❌ ADMIN_TOKEN looks too short (${#ADMIN_TOKEN}). Check .admin_token contents."
  exit 1
fi

echo "✅ ADMIN_TOKEN loaded (len=${#ADMIN_TOKEN})"

echo
echo "==> 1) Backend health"
curl -sS "$BACKEND_URL/health" | python -m json.tool || true

echo
echo "==> 2) Scraper env (if endpoint exists)"
curl -sS "$BACKEND_URL/debug/scraper-env" | python -m json.tool || echo "(no /debug/scraper-env endpoint yet)"

echo
echo "==> 2.5) Scrape probe (if endpoint exists)"
# Uses the same admin token gating as /import/*.
# This returns only metadata (blocked/parsed/timeout), never raw HTML.
curl -sS \
  -H "x-admin-token: $ADMIN_TOKEN" \
  "$BACKEND_URL/debug/scrape-probe?location=$(python -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$LOCATION")&sources=$(python -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$SOURCES")&page=$PAGE&timeout_seconds=$TIMEOUT_SECONDS" \
  | python -m json.tool \
  || echo "(no /debug/scrape-probe endpoint yet)"

echo
echo "==> 3) Properties count (before)"
curl -sS "$BACKEND_URL/debug/properties-count" | python -m json.tool || true

echo
echo "==> 4) (Optional) Direct ScraperAPI test from this shell"
if [ -n "${SCRAPERAPI_KEY-}" ]; then
  echo "SCRAPERAPI_KEY is set in this terminal ✅"
  curl -sS --get "https://api.scraperapi.com/" \
    --data-urlencode "api_key=$SCRAPERAPI_KEY" \
    --data-urlencode "render=true" \
    --data-urlencode "country_code=eu" \
    --data-urlencode "url=https://www.zoopla.co.uk/for-sale/property/london/" \
    | head -n 40
else
  echo "SCRAPERAPI_KEY is NOT set in this terminal (skipping direct ScraperAPI test)."
fi

echo
echo "==> 5) Run each importer ($LOCATION)"
echo "SUCCESS CRITERIA: for $LOCATION, /import/rightmove returns count > 0"
for src in zoopla rightmove onthemarket spareroom; do
  echo
  echo "---- POST /import/$src ----"

  http_code="$(curl -sS --max-time 240 -o "/tmp/import_${src}.out" -w "%{http_code}" \
    -X POST "$BACKEND_URL/import/$src" \
    -H "x-admin-token: $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"location\":\"$LOCATION\"}" || true)"

  echo "HTTP:$http_code"

  if python -m json.tool "/tmp/import_${src}.out" >/dev/null 2>&1; then
    python -m json.tool "/tmp/import_${src}.out"
  else
    echo "(non-JSON response; first 60 lines below)"
    sed -n '1,60p' "/tmp/import_${src}.out"
  fi

done

echo
echo "==> 6) Run /import/all?req=$LOCATION (aggregated)"
http_code="$(curl -sS --max-time 300 -o /tmp/import_all.out -w "%{http_code}" \
  -X POST "$BACKEND_URL/import/all?req=$(python -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$LOCATION")" \
  -H "x-admin-token: $ADMIN_TOKEN" || true)"
echo "HTTP:$http_code"
python -m json.tool /tmp/import_all.out || (echo "(non-JSON)"; sed -n '1,80p' /tmp/import_all.out)

echo
echo "==> 7) Properties count (after)"
curl -sS "$BACKEND_URL/debug/properties-count" | python -m json.tool || true

echo
echo "==> 8) Latest properties (if endpoint exists)"
curl -sS "$BACKEND_URL/properties?sort=created_at&dir=desc&limit=5" | python -m json.tool || echo "(no /properties endpoint or non-JSON response)"

echo
echo "✅ DONE"
