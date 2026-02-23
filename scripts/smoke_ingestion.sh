#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-${BACKEND_URL:-http://localhost:8000}}"
ADMIN_TOKEN="${ADMIN_TOKEN:-${X_ADMIN_TOKEN:-}}"

if [ -z "${ADMIN_TOKEN}" ]; then
  if [ -f ".admin_token" ]; then
    ADMIN_TOKEN="$(cat .admin_token | tr -d '\r\n')"
  fi
fi

if [ -z "${ADMIN_TOKEN}" ]; then
  echo "ERROR: ADMIN_TOKEN not set and .admin_token not found" >&2
  exit 1
fi

AUTH_STYLE="${AUTH_STYLE:-bearer}" # bearer or x-admin
if [ "$AUTH_STYLE" = "x-admin" ]; then
  AUTH_HEADER="X-Admin-Token: ${ADMIN_TOKEN}"
else
  AUTH_HEADER="Authorization: Bearer ${ADMIN_TOKEN}"
fi

tmp="$(mktemp)"
code=$(curl -sS -i -o "$tmp" -w "%{http_code}" \
  -X POST "$BASE_URL/admin/run-ingestion" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "${PAYLOAD:-{\"location\":\"London\",\"mode\":\"scraperapi\",\"limit\":5}}" \
)

cat "$tmp"
echo
rm -f "$tmp"

if [[ "$code" -lt 200 || "$code" -ge 300 ]]; then
  echo "Request failed: HTTP $code" >&2
  exit 1
fi

echo "OK"
