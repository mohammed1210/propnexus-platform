#!/usr/bin/env bash
set -euo pipefail

API_BASE=${1:-${API_BASE:-}}

if [[ -z "${API_BASE}" ]]; then
  echo "Usage: $0 <api-base-url>" >&2
  exit 1
fi

curl_check() {
  local method=$1
  local endpoint=$2
  local data=$3
  local expected_status=$4

  echo ""
  echo "=== ${method} ${API_BASE}${endpoint}"

  local response
  if [[ "${method}" == "GET" ]]; then
    response=$(curl -sS -w 'HTTPSTATUS:%{http_code}' "${API_BASE}${endpoint}")
  else
    response=$(curl -sS -w 'HTTPSTATUS:%{http_code}' \
      -H 'Content-Type: application/json' \
      -d "${data}" \
      -X "${method}" \
      "${API_BASE}${endpoint}")
  fi

  local body=$(echo "$response" | sed 's/HTTPSTATUS:.*//')
  local status=$(echo "$response" | sed 's/.*HTTPSTATUS://')

  echo "Status: ${status}"
  echo "Body: ${body:0:300}"

  if [[ "$status" -ne "$expected_status" ]]; then
    echo "Unexpected status: expected ${expected_status}, got ${status}" >&2
    exit 1
  fi
}

echo "Verifying PropNexus API at ${API_BASE}"

curl_check GET "/health" "" 200
curl_check GET "/properties" "" 200

payload='{"location":"RG1","budget":200000,"count":1}'
curl_check POST "/off-market/generate-off-market" "$payload" 200

echo ""
echo "All checks passed."