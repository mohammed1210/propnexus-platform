#!/usr/bin/env bash

# verify-deploy.sh
#
# Verifies that a deployed PropNexus backend is healthy by calling a set of
# well-known endpoints. This script expects one argument: the base URL of
# the API (e.g. https://api.example.com). Alternatively, set the API_BASE
# environment variable. It exits with a non-zero status on any failure.

set -euo pipefail

API_BASE=${1:-${API_BASE:-}}

if [[ -z "${API_BASE}" ]]; then
  echo "Usage: $0 <api-base-url>" >&2
  echo "You can also set the API_BASE environment variable." >&2
  exit 1
fi

# Normalize: remove trailing slash if present
API_BASE="${API_BASE%/}"

curl_check() {
  local method=$1
  local endpoint=$2
  local data=${3:-""}
  local expected_status=$4

  echo ""
  echo "=== ${method} ${API_BASE}${endpoint}"

  local response
  if [[ "${method}" == "GET" ]]; then
    response=$(curl -sS -w 'HTTPSTATUS:%{http_code}' "${API_BASE}${endpoint}" || true)
  else
    response=$(curl -sS -w 'HTTPSTATUS:%{http_code}' \
      -H 'Content-Type: application/json' \
      -d "${data}" \
      -X "${method}" \
      "${API_BASE}${endpoint}" || true)
  fi

  local body
  body=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')
  local status
  status=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

  echo "Status: ${status}"
  echo "Body: $(echo "$body" | head -c 300 | tr -d '\n')"

  if [[ "$status" -ne "$expected_status" ]]; then
    echo "Unexpected status code: expected ${expected_status}, got ${status}" >&2
    exit 1
  fi
}

echo "Verifying PropNexus API at ${API_BASE}"

# Health check
curl_check GET "/health" "" 200

# Properties endpoint
curl_check GET "/properties" "" 200

# Off-market generator (if enabled in this backend)
payload='{"location":"RG1","budget":200000,"count":1}'
curl_check POST "/off-market/generate-off-market" "$payload" 200

echo ""
echo "All checks passed."