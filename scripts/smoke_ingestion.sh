#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-${BACKEND_URL:-http://localhost:8000}}"

ADMIN_TOKEN="${ADMIN_TOKEN:-${X_ADMIN_TOKEN:-}}"
if [ -z "${ADMIN_TOKEN}" ] && [ -f ".admin_token" ]; then
  ADMIN_TOKEN="$(cat .admin_token)"
fi

if [ -z "${ADMIN_TOKEN}" ]; then
  echo "ERROR: ADMIN_TOKEN not set and .admin_token not found" >&2
  exit 1
fi

AUTH_STYLE="${AUTH_STYLE:-bearer}" # bearer | x-admin
if [ "${AUTH_STYLE}" = "x-admin" ]; then
  AUTH_HEADER="X-Admin-Token: ${ADMIN_TOKEN}"
else
  AUTH_HEADER="Authorization: Bearer ${ADMIN_TOKEN}"
fi

LOCATION="${LOCATION:-London}"
MODE="${MODE:-scraperapi}"
LIMIT="${LIMIT:-5}"

curl -sS -i -X POST "${BASE_URL}/admin/run-ingestion" \
  -H "Content-Type: application/json" \
  -H "${AUTH_HEADER}" \
  -d "{\"location\":\"${LOCATION}\",\"mode\":\"${MODE}\",\"limit\":${LIMIT}}"
