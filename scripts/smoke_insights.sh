#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
POSTCODE="${POSTCODE:-}"
AREA_KEY="${AREA_KEY:-}"

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

if [[ -z "$POSTCODE" ]]; then
  echo "Picking a POSTCODE from /properties?limit=1 ..."
  POSTCODE="$(
    curl -sS "$BASE_URL/properties?limit=1" |
      python - <<'PY'
import json,sys

try:
    d=json.load(sys.stdin)
except Exception:
    print("")
    raise SystemExit(0)

candidates=[]
if isinstance(d,dict):
    for k in ("data","properties","items","results"):
        v=d.get(k)
        if isinstance(v,list):
            candidates=v
            break
elif isinstance(d,list):
    candidates=d

pc=""
for item in candidates or []:
    if isinstance(item,dict) and item.get("postcode"):
        pc=str(item["postcode"]).strip()
        break
print(pc)
PY
  )"
fi

if [[ -z "$POSTCODE" ]]; then
  echo "ERROR: Could not determine POSTCODE (set POSTCODE manually)" >&2
  exit 3
fi

echo "POSTCODE=$POSTCODE"

if [[ -z "$AREA_KEY" ]]; then
  AREA_KEY="$POSTCODE"
fi

echo "AREA_KEY=$AREA_KEY"

export POSTCODE
export AREA_KEY

PC_ENC="$(python -c 'import urllib.parse,os; print(urllib.parse.quote(os.environ["POSTCODE"]))')"
KEY_ENC="$(python -c 'import urllib.parse,os; print(urllib.parse.quote(os.environ["AREA_KEY"]))')"

echo "---"
echo "GET /comps/{postcode}"
COMPS_JSON="$(curl -sS "$BASE_URL/comps/$PC_ENC")"
echo "$COMPS_JSON" | python -m json.tool >/dev/null

python - <<PY
import json
j=json.loads('''$COMPS_JSON''')
assert isinstance(j,dict), "comps payload must be object"
assert j.get('source')=='db', f"expected source=db, got {j.get('source')}"
count=j.get('count')
assert isinstance(count,int), f"count must be int, got {type(count)}"
print(f"comps.match_level={j.get('match_level')} count={count} median_price={j.get('median_price')} median_rent={j.get('median_rent')}")
PY

echo "---"
echo "GET /area-intel/{key}"
AREA_JSON="$(curl -sS "$BASE_URL/area-intel/$KEY_ENC")"
echo "$AREA_JSON" | python -m json.tool >/dev/null

python - <<PY
import json
j=json.loads('''$AREA_JSON''')
assert isinstance(j,dict), "area-intel payload must be object"
assert j.get('source')=='db', f"expected source=db, got {j.get('source')}"
count=j.get('count')
assert isinstance(count,int), f"count must be int, got {type(count)}"
print(f"area.match_level={j.get('match_level')} count={count} median_price={j.get('median_price')} median_rent={j.get('median_rent')} median_yield_percent={j.get('median_yield_percent')}")
PY

echo "OK: insights endpoints are DB-backed"
