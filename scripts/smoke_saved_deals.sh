#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
CLERK_USER_ID="${CLERK_USER_ID:-}"
PROPERTY_ID="${PROPERTY_ID:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "ERROR: BASE_URL is required (e.g. https://<railway-app>.up.railway.app)" >&2
  exit 2
fi

# Guard against placeholders (don’t silently default).
if [[ "$BASE_URL" == *"example.com"* ]] || [[ "$BASE_URL" == *"your-app"* ]]; then
  echo "ERROR: BASE_URL looks like a placeholder: $BASE_URL" >&2
  exit 2
fi

echo "BASE_URL=$BASE_URL"

if [[ -z "$CLERK_USER_ID" ]]; then
  echo "ERROR: CLERK_USER_ID is required (must start with user_)" >&2
  exit 2
fi
if [[ "$CLERK_USER_ID" != user_* ]]; then
  echo "ERROR: CLERK_USER_ID must start with user_: $CLERK_USER_ID" >&2
  exit 2
fi

echo "CLERK_USER_ID=$CLERK_USER_ID"

if [[ -z "$PROPERTY_ID" ]]; then
  echo "Picking a PROPERTY_ID from /properties?limit=1 ..."
  PROPERTY_ID="$(
    curl -sS "$BASE_URL/properties?limit=1" |
      python - <<'PY'
import json,sys

try:
    d=json.load(sys.stdin)
except Exception:
    print("")
    raise SystemExit(0)

# Common shapes:
# - {"data": [ {"id": "..."}, ... ]}
# - {"properties": [...]} (legacy)
# - [ {"id": "..."}, ... ]

candidates = []
if isinstance(d, dict):
    for k in ("data","properties","items","results"):
        v=d.get(k)
        if isinstance(v, list):
            candidates=v
            break
elif isinstance(d, list):
    candidates=d

pid=""
for item in candidates or []:
    if isinstance(item, dict) and item.get("id"):
        pid=str(item["id"]).strip()
        break
print(pid)
PY
  )"
fi

if [[ -z "$PROPERTY_ID" ]]; then
  echo "ERROR: Could not determine PROPERTY_ID (set PROPERTY_ID manually)" >&2
  exit 3
fi

echo "PROPERTY_ID=$PROPERTY_ID"

export PROPERTY_ID

echo "---"
echo "POST /save-deal"
curl -sS -X POST "$BASE_URL/save-deal" \
  -H 'content-type: application/json' \
  -H "X-Clerk-User-Id: $CLERK_USER_ID" \
  -d "{\"property_id\":\"$PROPERTY_ID\"}" | python -m json.tool

echo "---"
echo "GET /saved-deals"
SAVED_JSON="$(
  curl -sS "$BASE_URL/saved-deals" \
    -H "X-Clerk-User-Id: $CLERK_USER_ID"
)"
echo "$SAVED_JSON" | python -m json.tool >/dev/null

python - <<PY
import json,sys
j=json.loads('''$SAVED_JSON''')
rows=j.get('data') if isinstance(j,dict) else []
if not isinstance(rows,list):
    rows=[]
print(f"saved_deals_count={len(rows)}")
PY

echo "---"
echo "DELETE /save-deal?property_id=..."
curl -sS -X DELETE "$BASE_URL/save-deal?property_id=$(python -c 'import urllib.parse,os; print(urllib.parse.quote(os.environ["PROPERTY_ID"]))')" \
  -H "X-Clerk-User-Id: $CLERK_USER_ID" | python -m json.tool

echo "---"
echo "GET /saved-deals (after delete)"
AFTER_JSON="$(
  curl -sS "$BASE_URL/saved-deals" \
    -H "X-Clerk-User-Id: $CLERK_USER_ID"
)"
echo "$AFTER_JSON" | python -m json.tool >/dev/null

python - <<PY
import json
j=json.loads('''$AFTER_JSON''')
rows=j.get('data') if isinstance(j,dict) else []
if not isinstance(rows,list):
    rows=[]
# property_id may be a column, or nested in data.
prop_id = "$PROPERTY_ID"
found=False
for r in rows:
    if not isinstance(r,dict):
        continue
    if str(r.get('property_id') or '').strip()==prop_id:
        found=True
        break
    data=r.get('data')
    if isinstance(data,dict) and str(data.get('property_id') or '').strip()==prop_id:
        found=True
        break
print(f"saved_deals_count={len(rows)}")
if found:
    raise SystemExit("ERROR: property still present after delete")
print("OK: saved deal removed")
PY
