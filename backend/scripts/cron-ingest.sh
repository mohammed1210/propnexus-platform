#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BACKEND_BASE_URL:-}" ]; then
  echo "✘ BACKEND_BASE_URL not set"
  exit 1
fi

if [ -z "${IMPORT_ADMIN_TOKEN:-}" ]; then
  echo "✘ IMPORT_ADMIN_TOKEN not set"
  exit 1
fi

# Normalize base URL:
BASE="${BACKEND_BASE_URL%/}"
if [[ "$BASE" != http* ]]; then
  BASE="https://$BASE"
fi

URL="$BASE/admin/run-ingestion"

echo "[Cron] Starting ingestion via API endpoint..."
echo "[Cron] POST $URL"

# Capture both body + status
RESP_FILE="$(mktemp)"
HTTP_CODE="$(curl -sS -L -o "$RESP_FILE" -w "%{http_code}" \
  -X POST "$URL" \
  -H "Authorization: Bearer $IMPORT_ADMIN_TOKEN" \
  -H "Content-Type: application/json")"

echo "[Cron] HTTP $HTTP_CODE"
cat "$RESP_FILE"
echo

rm -f "$RESP_FILE"

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "202" ]]; then
  echo "✘ Cron failed (HTTP $HTTP_CODE)"
  exit 1
fi

echo "[Cron] Done."
