#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-${IMPORT_ADMIN_TOKEN:-}}"

if [[ -z "$BASE_URL" ]]; then
  echo "ERROR: BASE_URL is required (e.g. https://<railway-app>.up.railway.app)" >&2
  exit 2
fi

if [[ "$BASE_URL" == *"example.com"* ]] || [[ "$BASE_URL" == *"your-app"* ]]; then
  echo "ERROR: BASE_URL looks like a placeholder: $BASE_URL" >&2
  exit 2
fi

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ERROR: ADMIN_TOKEN (or IMPORT_ADMIN_TOKEN) is required" >&2
  exit 2
fi

echo "BASE_URL=$BASE_URL"

echo "---"
echo "POST /admin/seed-demo"
SEED_JSON="$(
  curl -sS -X POST "$BASE_URL/admin/seed-demo" \
    -H "x-admin-token: $ADMIN_TOKEN"
)"
echo "$SEED_JSON" | python -m json.tool

python - <<PY
import json
j=json.loads('''$SEED_JSON''')
assert j.get('ok') is True
seeded=int(j.get('seeded') or 0)
if seeded < 1:
    raise SystemExit('ERROR: seeded < 1')
print(f"OK: seeded={seeded}")
PY

echo "---"
echo "GET /properties?limit=3"
curl -sS "$BASE_URL/properties?limit=3" | python -m json.tool >/dev/null

echo "OK: /properties returned JSON"
