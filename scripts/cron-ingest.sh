#!/usr/bin/env bash
set -euo pipefail

echo "[Cron] Starting ingestion via API endpoint…"

# Configuration from environment variables
API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
API_BASE_URL="${API_BASE_URL%/}"
ADMIN_TOKEN="${ADMIN_TOKEN:-${IMPORT_ADMIN_TOKEN:-${API_KEY:-}}}"
LOCATIONS="${LOCATIONS:-London,Manchester}"

FAIL_ON_ZERO="${FAIL_ON_ZERO:-1}"

# Ensure we have required variables
if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Error: ADMIN_TOKEN (or IMPORT_ADMIN_TOKEN / API_KEY) environment variable is required"
  exit 1
fi

# Health check
echo "[Cron] Performing health check on $API_BASE_URL/health..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/health" || echo "000")

if [ "$HEALTH_STATUS" != "200" ]; then
  echo "❌ Health check failed with status $HEALTH_STATUS"
  exit 1
fi

echo "✅ Health check passed"

urlencode() {
  python - <<'PY' "$1"
import sys
import urllib.parse

print(urllib.parse.quote(sys.argv[1]))
PY
}

# Split locations by comma and import each one
IFS=',' read -ra LOCATION_ARRAY <<< "$LOCATIONS"
TOTAL_COUNT=0

for location in "${LOCATION_ARRAY[@]}"; do
  # Trim whitespace
  location=$(echo "$location" | xargs)

  if [ -z "$location" ]; then
    continue
  fi

  echo "[Cron] Importing properties for location: $location"

  # Call /import/all endpoint (expects ?req=...)
  ENC_LOCATION="$(urlencode "$location")"
  RESPONSE=$(curl -s -X POST "$API_BASE_URL/import/all?req=$ENC_LOCATION" \
    -H "x-admin-token: $ADMIN_TOKEN" \
    -w "\n%{http_code}" || echo -e "\n000")

  # Extract status code (last line)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  # Extract body (all but last line)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ Import failed for $location with status $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
  fi

  # Parse total_imported from JSON response
  COUNT=$(python - <<'PY' "$BODY"
import json
import sys

raw = sys.argv[1] if len(sys.argv) > 1 else ""
try:
    data = json.loads(raw)
except Exception:
    data = {}

val = data.get("total_imported", data.get("count", 0))
try:
    print(int(val or 0))
except Exception:
    print(0)
PY
)

  WARNING=$(python - <<'PY' "$BODY"
import json
import sys

raw = sys.argv[1] if len(sys.argv) > 1 else ""
try:
    data = json.loads(raw)
except Exception:
    data = {}

warn = data.get("warning")
print(warn if isinstance(warn, str) else "")
PY
)

  echo "✅ Imported $COUNT properties for $location"
  if [ -n "$WARNING" ]; then
    echo "⚠️  Warning for $location: $WARNING"
  fi
  TOTAL_COUNT=$((TOTAL_COUNT + COUNT))
done

# Fail if no properties were imported
if [ "$TOTAL_COUNT" -eq 0 ]; then
  if [ "$FAIL_ON_ZERO" = "1" ]; then
    echo "❌ Error: Total imported count is zero across all locations"
    exit 1
  fi
  echo "⚠️  Total imported count is zero across all locations (FAIL_ON_ZERO=0; not failing)"
fi

echo "✅ Successfully imported $TOTAL_COUNT properties in total"
exit 0
