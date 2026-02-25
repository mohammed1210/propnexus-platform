#!/usr/bin/env bash
set -euo pipefail

# Smoke test for backend endpoints used by the frontend.
#
# Usage:
#   BASE_URL=http://localhost:8000 ./scripts/smoke_frontend_backend.sh
#
# Optional:
#   AREA_KEY=SW1A1AA POSTCODE=SW1A1AA BASE_URL=... ./scripts/smoke_frontend_backend.sh

BASE_URL="${BASE_URL:-http://localhost:8000}"
AREA_KEY="${AREA_KEY:-}"
POSTCODE="${POSTCODE:-}"

say() { echo "[smoke] $*"; }

curl_json() {
  local url="$1"
  say "GET  $url"
  curl -fsS "$url" -H 'Accept: application/json'
}

curl_json_post() {
  local url="$1"
  local body="$2"
  say "POST $url"
  curl -fsS "$url" -H 'Accept: application/json' -H 'Content-Type: application/json' --data "$body"
}

# 1) /health
curl_json "$BASE_URL/health" > /tmp/propnexus_health.json

# 2) /properties?limit=1
curl_json "$BASE_URL/properties?limit=1" > /tmp/propnexus_properties.json

# Derive a property id + postcode (fallback to a safe default)
python3 - <<'PY'
import json
import os

with open('/tmp/propnexus_properties.json','r',encoding='utf-8') as f:
    data = json.load(f)

items = data.get('items') if isinstance(data, dict) else None
item0 = items[0] if isinstance(items, list) and items else {}

pid = item0.get('id')
pc = item0.get('postcode') or item0.get('location') or ''

# Very light canonicalization: remove spaces for backend routes.
pc = ''.join(str(pc).split()).upper()

if not pid:
    pid = ''

if not pc:
    pc = 'SW1A1AA'

out = {'id': str(pid), 'postcode': pc}
print(json.dumps(out))
PY

DERIVED=$(python3 - <<'PY'
import json

with open('/tmp/propnexus_properties.json','r',encoding='utf-8') as f:
    data = json.load(f)
items = data.get('items') if isinstance(data, dict) else None
item0 = items[0] if isinstance(items, list) and items else {}
pid = item0.get('id')
pc = item0.get('postcode') or item0.get('location') or ''
pc = ''.join(str(pc).split()).upper()
if not pc:
    pc = 'SW1A1AA'
print((str(pid) if pid else '') + '|' + pc)
PY
)

PROP_ID="${DERIVED%%|*}"
DERIVED_PC="${DERIVED##*|}"

if [[ -z "$POSTCODE" ]]; then
  POSTCODE="$DERIVED_PC"
fi
if [[ -z "$AREA_KEY" ]]; then
  AREA_KEY="$POSTCODE"
fi

# 3) /properties/{id} (only if we got an id)
if [[ -n "$PROP_ID" ]]; then
  curl_json "$BASE_URL/properties/$PROP_ID" > /tmp/propnexus_property.json
else
  say "WARN: no property id returned from /properties?limit=1; skipping /properties/{id}"
fi

# 4) /area-intel/{pc}
curl_json "$BASE_URL/area-intel/$AREA_KEY" > /tmp/propnexus_area_intel.json

# 5) /comps/{pc}
curl_json "$BASE_URL/comps/$POSTCODE" > /tmp/propnexus_comps.json

say "OK: smoke requests succeeded"
say "Saved: /tmp/propnexus_{health,properties,property,area_intel,comps}.json"
