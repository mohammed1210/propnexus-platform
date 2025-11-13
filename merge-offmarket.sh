#!/usr/bin/env bash
set -euo pipefail

### CONFIG (edit if your repo/branch names differ)
OFFMARKET_REPO_URL="https://github.com/mohammed1210/propnexus-off-market.git"
OFFMARKET_BRANCH="main"

echo "🔎 Step 0: Confirming we’re in propnexus-platform..."
if [ ! -d "frontend" ] || [ ! -f "frontend/package.json" ] || [ ! -d "backend" ]; then
  echo "❌ This doesn’t look like the propnexus-platform root (frontend/backend missing)."
  echo "   Run this script from /workspaces/propnexus-platform"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Your working tree is not clean. Commit or stash your changes first."
  git status
  exit 1
fi

echo "✅ In propnexus-platform repo and working tree is clean."

### 1. Clone off-market repo into a temp folder
TMP_DIR="../propnexus-off-market-tmp-$$"
echo "📥 Cloning off-market repo into $TMP_DIR ..."
git clone --branch "$OFFMARKET_BRANCH" --depth 1 "$OFFMARKET_REPO_URL" "$TMP_DIR"

### 2. Copy backend Off-Market routes
echo "📂 Copying backend Off-Market routes (if present)..."
mkdir -p backend/routes

if [ -f "$TMP_DIR/backend/routes/offmarket_routes.py" ]; then
  cp "$TMP_DIR/backend/routes/offmarket_routes.py" backend/routes/
  echo "   ➕ Copied backend/routes/offmarket_routes.py"
elif ls "$TMP_DIR/backend/routes/"off*market*py >/dev/null 2>&1; then
  for f in "$TMP_DIR"/backend/routes/off*market*py; do
    cp "$f" backend/routes/
    echo "   ➕ Copied $(basename "$f") into backend/routes/"
  done
else
  echo "   ⚠ No obvious off-market routes file found in backend/routes/"
fi

### 3. Copy frontend Off-Market app route
echo "📂 Copying frontend Off-Market route..."
if [ -d "$TMP_DIR/frontend/app/off-market" ]; then
  mkdir -p frontend/app/off-market
  cp -R "$TMP_DIR/frontend/app/off-market/." frontend/app/off-market/
  echo "   ➕ Copied frontend/app/off-market/*"
elif [ -d "$TMP_DIR/frontend/app/offmarket" ]; then
  mkdir -p frontend/app/offmarket
  cp -R "$TMP_DIR/frontend/app/offmarket/." frontend/app/offmarket/
  echo "   ➕ Copied frontend/app/offmarket/*"
else
  echo "   ⚠ No obvious off-market app route folder found (off-market or offmarket)."
fi

### 4. Copy frontend Off-Market components (optional)
echo "📂 Copying frontend Off-Market components (if present)..."
if [ -d "$TMP_DIR/frontend/components/offmarket" ]; then
  mkdir -p frontend/components/offmarket
  cp -R "$TMP_DIR/frontend/components/offmarket/." frontend/components/offmarket/
  echo "   ➕ Copied frontend/components/offmarket/*"
elif [ -d "$TMP_DIR/frontend/components/off-market" ]; then
  mkdir -p frontend/components/off-market
  cp -R "$TMP_DIR/frontend/components/off-market/." frontend/components/off-market/
  echo "   ➕ Copied frontend/components/off-market/*"
else
  echo "   ℹ No dedicated off-market components directory found; skipping."
fi

### 5. Wire backend router into backend/main.py
BACKEND_MAIN="backend/main.py"
echo "🧩 Wiring Off-Market router into $BACKEND_MAIN (if not already present)..."

if [ -f "$BACKEND_MAIN" ]; then
  if ! grep -q "offmarket_router" "$BACKEND_MAIN"; then
    cat << 'PY' >> "$BACKEND_MAIN"

# ---- Auto-added Off-Market router integration ----
try:
    from routes.offmarket_routes import router as offmarket_router  # type: ignore
    app.include_router(offmarket_router, prefix="/offmarket", tags=["Off-Market"])
except Exception as e:  # pragma: no cover - defensive
    print(f"Warning: failed to load Off-Market routes: {e}")
# ---- End Off-Market block ----
PY
    echo "   ➕ Appended Off-Market router import + include_router() block."
  else
    echo "   ℹ Off-Market router already referenced in backend/main.py; leaving as is."
  fi
else
  echo "   ❌ backend/main.py not found — cannot wire router automatically."
fi

### 6. Clean up temp clone
echo "🧹 Cleaning up temp clone..."
rm -rf "$TMP_DIR"

### 7. Show resulting git status and reminder
echo
echo "✅ Off-Market code copied into propnexus-platform."
echo "🔍 Please review the changes now:"
echo
git status
echo
echo "👉 Next steps (manual but quick):"
echo "   1) Add a nav link to the Off-Market page in your Navbar component, e.g.:"
echo '        <Link href="/off-market">Off-Market</Link>'
echo "   2) Ensure any Supabase tables used by Off-Market exist (I can generate SQL)."
echo "   3) Run:  npm install  (if new frontend deps)  and  npm run dev  /  npm run build."
echo "   4) When happy, commit and push:"
echo "        git add ."
echo '        git commit -m "Integrate Off-Market module from Spark repo"'
echo "        git push origin main"
echo
echo "All done 🎉"
