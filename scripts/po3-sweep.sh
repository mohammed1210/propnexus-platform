#!/usr/bin/env bash
set -euo pipefail

echo "==> PropNexus PO3 sweep (fetch + buttons)"

# --- Files to patch (from your grep) ---
fetch_files=(
  "frontend/app/off_market_page.tsx"
  "frontend/app/saved-deals/page.tsx"
  "frontend/components/PropertyCard.tsx"
  "frontend/components/account/UpgradeButton.tsx"
  "frontend/components/property-details/InvestmentSummary.tsx"
  "frontend/components/property_details/AreaIntel.tsx"
  "frontend/components/property_details/CompsMini.tsx"
  "frontend/components/property_details/InvestmentInsights.tsx"
)

btn_files=(
  "frontend/app/listings/page.tsx"
  "frontend/app/saved-deals/page.tsx"
  "frontend/components/property_details/ExitStrategyGenerator.tsx"
  "frontend/components/property_details/ExportActions.tsx"
)

# --- helper: add fetchWithRetry import if missing ---
add_import() {
  local file="$1"
  if ! grep -q "from '@/lib/api'" "$file" 2>/dev/null; then
    # Insert after first import line
    awk '
      BEGIN{added=0}
      /^import / && added==0 { print; print "import { fetchWithRetry } from '\''@/lib/api'\'';"; added=1; next }
      { print }
      END{ if(added==0) print "import { fetchWithRetry } from '\''@/lib/api'\'';" }
    ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    echo "  + import added -> $file"
  fi
}

# --- 1) Clean dynamic imports and swap fetch() -> fetchWithRetry() ---
for f in "${fetch_files[@]}"; do
  if [[ -f "$f" ]]; then
    echo "-- patching: $f"
    # remove lines like: const { fetchWithRetry } = await import('@/lib/api');
    sed -i "/await import(['\"]@\/lib\/api['\"]).*/d" "$f" || true

    # add static import if needed
    add_import "$f"

    # swap fetch( -> fetchWithRetry( (but NOT in lib/api or comments)
    sed -i "s/\bfetch\s*(/fetchWithRetry(/g" "$f"
  else
    echo "!! missing file (skipped): $f"
  fi
done

# --- 2) Button class renames (safely scoped) ---
# map: btn -> pnx-btn ; btn-primary -> pnx-btn-primary ; btn-outline -> pnx-btn-outline
for f in "${btn_files[@]}"; do
  if [[ -f "$f" ]]; then
    echo "-- buttons in: $f"
    # narrow to className strings; simple global replacements are fine here
    sed -i -E "s/\bbtn-primary\b/pnx-btn-primary/g" "$f"
    sed -i -E "s/\bbtn-outline\b/pnx-btn-outline/g" "$f"
    sed -i -E "s/\bbtn\b/pnx-btn/g" "$f"
  else
    echo "!! missing file (skipped): $f"
  fi
done

echo "==> Sweep complete."
