#!/usr/bin/env bash
# ============================================================
# PROPNEXUS — SPRINT: GET SCRAPERS LIVE (ONE-SHOT RUNNER)
# Run from repo root: bash scripts/codespace-sprint-scrapers-live.sh
# ============================================================

set -euo pipefail

ROOT="/workspaces/propnexus-platform"
cd "$ROOT"

PY="$ROOT/.venv/bin/python"

echo "============================================================"
echo "1) BASELINE CHECKS"
echo "============================================================"

git status -sb | cat
if [[ -n "$(git status --porcelain=v1)" ]]; then
  echo "❌ Working tree is not clean. Commit/stash before running." >&2
  git status --porcelain=v1 | cat
  exit 1
fi

echo "✅ Repo is clean"
echo "--- last commit ---"
git --no-pager log -1 --oneline

echo "============================================================"
echo "2) CONFIRM KEY PATHS EXIST"
echo "============================================================"

[[ -f "$ROOT/backend/main.py" ]] || { echo "❌ Missing backend/main.py"; exit 1; }
[[ -d "$ROOT/backend/routes" ]] || { echo "❌ Missing backend/routes"; exit 1; }
[[ -d "$ROOT/backend/scraper" ]] || { echo "❌ Missing backend/scraper"; exit 1; }

echo "✅ backend/ exists with routes/ + scraper/"

echo "============================================================"
echo "3) BACKEND: QUICK ROUTE CHECK"
echo "============================================================"

echo "Looking for /properties + /import/all + /import/zoopla + /scrape..."
grep -RIn --line-number "@router\.get\(\"/properties\"\)|prefix=\"/import\"|@router\.post\(\"/all\"\)|@router\.post\(\"/zoopla\"\)|@router\.post\(\"/scrape\"\)" "$ROOT/backend/routes" | head -n 80 || true

echo "============================================================"
echo "4) SUPABASE: SCHEMA REQUIREMENTS (PRINT SQL)"
echo "============================================================"

SQL_FILE="$ROOT/supabase/scraper_schema_patch.sql"
[[ -f "$SQL_FILE" ]] || { echo "❌ Missing $SQL_FILE"; exit 1; }

echo "------------------------------------------------------------"
echo "COPY THIS SQL INTO SUPABASE SQL EDITOR AND RUN IT:"
echo "------------------------------------------------------------"
cat "$SQL_FILE"
echo "------------------------------------------------------------"
echo ""
echo "🚨 ACTION REQUIRED: run the SQL above in Supabase, then continue."

read -r -p "Press ENTER after you ran the SQL in Supabase... " _

echo "============================================================"
echo "5) PYTHON DEPENDENCY SMOKE CHECK"
echo "============================================================"

"$PY" - <<'PY'
import pkgutil
mods = ["aiohttp", "bs4", "supabase"]
missing = [m for m in mods if not pkgutil.find_loader(m)]
print("missing:", missing)
PY

echo "If missing != [], install deps in backend/.venv before continuing."

echo "============================================================"
echo "6) QUICK UNIT TESTS (BACKEND)"
echo "============================================================"

if [[ -f "$ROOT/backend/pytest.ini" || -f "$ROOT/pytest.ini" ]]; then
  "$PY" -m pytest -q backend/tests/test_properties_routes.py
else
  echo "ℹ️ No pytest config detected; skipping."
fi

echo "============================================================"
echo "✅ DONE"
echo "Next steps (when deployed with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):"
echo "- POST /import/all?req=London (optionally with X-Admin-Token)"
echo "- GET  /properties?limit=5"
