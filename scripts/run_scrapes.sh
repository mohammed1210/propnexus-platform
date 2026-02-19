#!/usr/bin/env bash
set -euo pipefail

# ===========================
# PropNexus scrape runner
# ===========================
# Usage:
#   BASE_URL="https://YOUR-RAILWAY-APP.up.railway.app" LOCATION="London" ./scripts/run_scrapes.sh
#
# Auth:
#   These /import/* endpoints require an admin token.
#   Provide one of:
#     - ADMIN_TOKEN env var
#     - .admin_token file in repo root
#
# Notes:
#   This repo's scrape endpoints are:
#     - POST /import/rightmove
#     - POST /import/zoopla
#   (Not /scrape-rightmove or /scrape-zoopla.)

BASE_URL="${BASE_URL:-http://localhost:8000}"
BASE_URL="${BASE_URL%/}"
LOCATION="${LOCATION:-London}"

# Optional: control Zoopla pagination (API caps at 5).
MAX_PAGES="${MAX_PAGES:-1}"

# Optional: if you have a separate API key gateway, you can set API_KEY and
# uncomment the header below.
API_KEY="${API_KEY:-}"

# Load admin token from file if not provided.
if [[ -z "${ADMIN_TOKEN:-}" ]] && [[ -f ".admin_token" ]]; then
  ADMIN_TOKEN="$(cat .admin_token)"
  export ADMIN_TOKEN
fi

if [[ -z "${ADMIN_TOKEN:-}" ]]; then
  echo "ERROR: ADMIN_TOKEN not set and .admin_token missing" >&2
  exit 1
fi

common_headers=(
  -H "Content-Type: application/json"
  -H "x-admin-token: ${ADMIN_TOKEN}"
)

# If you use an API key gateway, uncomment:
# if [[ -n "$API_KEY" ]]; then common_headers+=( -H "X-API-Key: ${API_KEY}" ); fi

echo "== PropNexus Scrape Runner =="
echo "BASE_URL:  $BASE_URL"
echo "LOCATION:  $LOCATION"
echo "MAX_PAGES: $MAX_PAGES"
echo

post() {
  local path="$1"
  local body="$2"
  echo "POST $path"

  # Print status code while still outputting body.
  local out http
  out=$(curl -sS -w "\n__HTTP_STATUS__:%{http_code}" -X POST "$BASE_URL$path" "${common_headers[@]}" -d "$body")
  http="${out##*__HTTP_STATUS__:}"
  echo "  HTTP $http"
  echo "  Body:"
  echo "${out%__HTTP_STATUS__:*}" | sed 's/^/    /'
  echo

  if [[ "$http" == "401" ]]; then
    echo "ERROR: Unauthorized (check ADMIN_TOKEN)" >&2
    exit 1
  fi
  if [[ "$http" == "404" ]]; then
    echo "ERROR: Endpoint not found: $path" >&2
    exit 1
  fi
}

get() {
  local path="$1"
  echo "GET $path"
  curl -sS "$BASE_URL$path" | head -c 800 | sed 's/^/  /'
  echo
  echo
}

# 1) Trigger imports (scrape + normalize + upsert)
post "/import/rightmove" "{\"location\":\"${LOCATION}\"}"
post "/import/zoopla?max_pages=${MAX_PAGES}" "{\"location\":\"${LOCATION}\"}"

# 2) Quick sanity check that /properties responds
get "/properties?sort=created_at&dir=desc&limit=5"

echo "Done. Now check Supabase image columns (image_urls / imageurl / image_count)."
