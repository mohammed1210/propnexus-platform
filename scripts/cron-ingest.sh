#!/usr/bin/env bash
set -euo pipefail

echo "[Cron] Starting ingestion via API endpoint…"

# Configuration from environment variables
API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-}"
LOCATIONS="${LOCATIONS:-London,Manchester}"

# Ensure we have required variables
if [ -z "$API_KEY" ]; then
  echo "❌ Error: API_KEY environment variable is required"
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
  
  # Call /import/all endpoint
  RESPONSE=$(curl -s -X POST "$API_BASE_URL/import/all" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "{\"location\": \"$location\"}" \
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
  
  # Parse count from JSON response using grep and sed
  COUNT=$(echo "$BODY" | grep -o '"count"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*')
  
  if [ -z "$COUNT" ]; then
    COUNT=0
  fi
  
  echo "✅ Imported $COUNT properties for $location"
  TOTAL_COUNT=$((TOTAL_COUNT + COUNT))
done

# Fail if no properties were imported
if [ "$TOTAL_COUNT" -eq 0 ]; then
  echo "❌ Error: Total imported count is zero across all locations"
  exit 1
fi

echo "✅ Successfully imported $TOTAL_COUNT properties in total"
exit 0
