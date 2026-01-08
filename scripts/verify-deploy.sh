#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/verify-deploy.sh https://your-backend-url
# or rely on API_BASE env var in CI

API_BASE="${1:-${API_BASE:-}}"

if [[ -z "${API_BASE}" ]]; then
  echo "Usage: $0 <api-base-url>"
  echo "Example: $0 https://propnexus-backend.up.railway.app"
  exit 1
fi

echo "Verifying PropNexus API at ${API_BASE}"
echo "---------------------------------------"

curl_check() {
  local method="$1"
  local endpoint="$2"
  local expected="$3"
  local data="${4:-}"

  echo "=== ${method} ${API_BASE}${endpoint}"

  local response
  if [[ "$method" == "GET" ]]; then
    response=$(curl -sS -w 'HTTPSTATUS:%{http_code}' \
      "${API_BASE}${endpoint}")
  else
    response=$(curl -sS -w 'HTTPSTATUS:%{http_code}' \
      -H 'Content-Type: application/json' \
      -X "$method" \
      -d "$data" \
      "${API_BASE}${endpoint}")
  fi

  local body
  body=$(echo "$response" | sed 's/HTTPSTATUS:.*//')

  local status
  status=$(echo "$response" | tr -d '\n' | sed 's/.*HTTPSTATUS://')

  echo "Status: $status"
  echo "Body: ${body:0:300}"

  if [[ "$status" -ne "$expected" ]]; then
    echo "❌ Expected $expected, got $status"
    exit 1
  fi

  echo "✅ OK"
  echo
}

# ---- Required backend endpoints ----

curl_check GET "/health" 200
curl_check GET "/properties" 200

# Optional: Off-market endpoint (safe payload)
payload='{"location":"UB8","budget":250000,"count":1}'
curl_check POST "/off-market/generate-off-market" 200 "$payload"

echo "---------------------------------------"
echo "✅ All deployment checks passed."
