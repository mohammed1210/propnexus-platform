#!/usr/bin/env bash
# tools/import-all.sh
# Import properties from multiple locations using the scraper API
#
# Usage:
#   API_BASE=http://localhost:8000 OFF_MARKET_ADMIN_TOKEN=your-token ./tools/import-all.sh "Ilford,Romford,East London"
#
# Environment variables required:
#   API_BASE              - Base URL of the API (e.g., http://localhost:8000)
#   OFF_MARKET_ADMIN_TOKEN - Admin API key for authentication

set -e

# Check required environment variables
if [ -z "$API_BASE" ]; then
  echo "❌ ERROR: API_BASE environment variable is not set"
  echo "Usage: API_BASE=http://localhost:8000 OFF_MARKET_ADMIN_TOKEN=your-token $0 \"Location1,Location2\""
  exit 1
fi

if [ -z "$OFF_MARKET_ADMIN_TOKEN" ]; then
  echo "❌ ERROR: OFF_MARKET_ADMIN_TOKEN environment variable is not set"
  echo "Usage: API_BASE=http://localhost:8000 OFF_MARKET_ADMIN_TOKEN=your-token $0 \"Location1,Location2\""
  exit 1
fi

# Check if locations argument is provided
if [ -z "$1" ]; then
  echo "❌ ERROR: Locations CSV argument is required"
  echo "Usage: API_BASE=http://localhost:8000 OFF_MARKET_ADMIN_TOKEN=your-token $0 \"Location1,Location2\""
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ ERROR: jq is not installed. Please install jq to parse JSON."
  exit 1
fi

LOCATIONS_CSV="$1"
TOTAL_COUNT=0

echo "================================================"
echo "🚀 Starting property imports"
echo "================================================"
echo "API Base: $API_BASE"
echo "Locations: $LOCATIONS_CSV"
echo "================================================"
echo ""

# Split CSV and process each location
IFS=',' read -ra LOCATIONS <<< "$LOCATIONS_CSV"

for LOCATION in "${LOCATIONS[@]}"; do
  # Trim whitespace
  LOCATION=$(echo "$LOCATION" | xargs)
  
  echo "🔄 Importing: $LOCATION"
  echo "---"
  
  # Make the API request
  RESPONSE=$(curl -s -X POST \
    "$API_BASE/import/all" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $OFF_MARKET_ADMIN_TOKEN" \
    -d "{\"location\": \"$LOCATION\"}")
  
  # Pretty print the JSON response
  echo "$RESPONSE" | jq '.'
  
  # Extract count
  COUNT=$(echo "$RESPONSE" | jq -r '.count // 0')
  TOTAL_COUNT=$((TOTAL_COUNT + COUNT))
  
  echo "✅ Imported $COUNT properties from $LOCATION"
  echo ""
done

echo "================================================"
echo "📊 IMPORT SUMMARY"
echo "================================================"
echo "Total properties imported: $TOTAL_COUNT"
echo "================================================"

if [ "$TOTAL_COUNT" -eq 0 ]; then
  echo "⚠️  WARNING: No properties were imported"
  exit 1
fi

echo "✅ Import completed successfully!"
