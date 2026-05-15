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
LOCATION="${INGEST_LOCATION:-${INGEST_LOCATIONS%%,*}}"
LOCATION="${LOCATION:-London}"
MODE="${SCRAPER_MODE:-direct}"
SOURCES="${INGEST_SOURCES:-zoopla,onthemarket,spareroom}"
LIMIT_JSON=""
if [ -n "${INGEST_LIMIT:-}" ]; then
  LIMIT_JSON=",\"limit\":${INGEST_LIMIT}"
fi
PAYLOAD="{\"location\":\"$LOCATION\",\"mode\":\"$MODE\",\"sources\":["
IFS=',' read -ra SOURCE_PARTS <<< "$SOURCES"
first_source=1
for i in "${!SOURCE_PARTS[@]}"; do
  src="$(echo "${SOURCE_PARTS[$i]}" | xargs)"
  [ -z "$src" ] && continue
  if [ "$first_source" != "1" ]; then
    PAYLOAD+=","
  fi
  PAYLOAD+="\"$src\""
  first_source=0
done
PAYLOAD+="]$LIMIT_JSON}"

echo "[Cron] Starting ingestion via API endpoint..."
echo "[Cron] POST $URL"
echo "[Cron] location=$LOCATION mode=$MODE sources=$SOURCES"

# Capture both body + status
RESP_FILE="$(mktemp)"
HTTP_CODE="$(curl -sS -L -o "$RESP_FILE" -w "%{http_code}" \
  -X POST "$URL" \
  -H "Authorization: Bearer $IMPORT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")"

echo "[Cron] HTTP $HTTP_CODE"
cat "$RESP_FILE"
echo

rm -f "$RESP_FILE"

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "202" ]]; then
  echo "✘ Cron failed (HTTP $HTTP_CODE)"
  exit 1
fi

echo "[Cron] Done."
