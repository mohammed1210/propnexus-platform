#!/usr/bin/env bash
# Simple test script for PropNexus /off-market/create
# Save this file as backend/test_off_market.sh and make it executable with:
#   chmod +x backend/test_off_market.sh

BASE="https://propnexus-backend-production.up.railway.app"

# Replace this with your real Railway OFF_MARKET_ADMIN_TOKEN
TOKEN="fae52900cca3538e4c7006e8d6195171baea22b63540f157d4b220658b51e934"

echo "Creating off-market deal via $BASE/off-market/create ..."

curl -sS -X POST "$BASE/off-market/create" \
  -H "content-type: application/json" \
  -H "X-API-Key: $TOKEN" \
  -d '{
    "title": "Admin gated deal",
    "location": "London",
    "price": 350000,
    "bedrooms": 2,
    "bathrooms": 1,
    "investment_type": "Flip",
    "contact": "agent@example.com"
  }' | jq .
