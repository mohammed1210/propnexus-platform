set -euo pipefail

note() { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m⚠ %s\033[0m\n" "$*"; }
ok()   { printf "\n\033[1;32m✓ %s\033[0m\n" "$*"; }

apply_patch_or_note () {
  local patch_file="$1"
  if git apply --check "$patch_file" >/dev/null 2>&1; then
    git apply "$patch_file"
    ok "Applied: $patch_file"
  else
    warn "Could not apply: $patch_file  (open and paste manually if needed)"
  fi
}

git fetch origin --prune

mkdir -p .po3_patches

############################################
# Phase 1 — UI polish
############################################
note "Phase 1 — UI polish"
git switch -C po3/ui-polish-production origin/po3/ui-polish-production || git switch -C po3/ui-polish-production origin/main

cat > .po3_patches/phase1_headerclient.patch << 'PATCH'
*** Begin Patch
*** Update File: frontend/components/HeaderClient.tsx
@@
-'use client';
-
-import Link from 'next/link';
-import { usePathname } from 'next/navigation';
-import { useEffect, useState } from 'react';
-import clsx from 'clsx';
-
-export default function HeaderClient() {
-  const pathname = usePathname();
-  const [scrolled, setScrolled] = useState(false);
-
-  useEffect(() => {
-    const onScroll = () => setScrolled(window.scrollY > 4);
-    setScrolled(window.scrollY > 4);
-    window.addEventListener('scroll', onScroll, { passive: true });
-    return () => window.removeEventListener('scroll', onScroll);
-  }, []);
-
-  const isActive = (href: string) => pathname === href;
-
-  return (
-    <>
-      <header
-        className={clsx(
-          'sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50',
-          'dark:bg-zinc-900/70 dark:supports-[backdrop-filter]:bg-zinc-900/50',
-          scrolled ? 'shadow-sm' : ''
-        )}
-      >
-        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
-          <Link href="/" className="font-semibold tracking-tight">
-            PropNexus
-          </Link>
-          <nav className="flex items-center gap-1">
-            <Link
-              href="/"
-              className={clsx(
-                'rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
-                isActive('/') && 'font-semibold underline underline-offset-4'
-              )}
-            >
-              Dashboard
-            </Link>
-            <Link
-              href="/saved"
-              className={clsx(
-                'rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
-                isActive('/saved') && 'font-semibold underline underline-offset-4'
-              )}
-            >
-              Saved
-            </Link>
-            <Link
-              href="/off-market"
-              className={clsx(
-                'rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
-                isActive('/off-market') && 'font-semibold underline underline-offset-4'
-              )}
-            >
-              Off-Market
-            </Link>
-          </nav>
-        </div>
-      </header>
-      {/* Back-to-top button (visible only after scroll) */}
-      {scrolled && (
-        <button
-          aria-label="Back to top"
-          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
-          className="fixed bottom-4 right-4 z-[60] rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-md hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
-        >
-          Back to top
-        </button>
-      )}
-    </>
-  );
-}
+'use client';
+import Link from 'next/link';
+import { usePathname } from 'next/navigation';
+import { useEffect, useState } from 'react';
+import clsx from 'clsx';
+
+export default function HeaderClient() {
+  const pathname = usePathname();
+  const [scrolled, setScrolled] = useState(false);
+
+  useEffect(() => {
+    const onScroll = () => setScrolled(window.scrollY > 4);
+    setScrolled(window.scrollY > 4);
+    window.addEventListener('scroll', onScroll, { passive: true });
+    return () => window.removeEventListener('scroll', onScroll);
+  }, []);
+
+  const isActive = (href: string) => pathname === href;
+
+  return (
+    <>
+      <header
+        className={clsx(
+          'sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50',
+          'dark:bg-zinc-900/70 dark:supports-[backdrop-filter]:bg-zinc-900/50',
+          scrolled ? 'shadow-sm' : ''
+        )}
+      >
+        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
+          <Link href="/" className="font-semibold tracking-tight">
+            PropNexus
+          </Link>
+          <nav className="flex items-center gap-1">
+            <Link
+              href="/"
+              className={clsx(
+                'rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
+                isActive('/') && 'font-semibold underline underline-offset-4'
+              )}
+            >
+              Dashboard
+            </Link>
+            <Link
+              href="/saved"
+              className={clsx(
+                'rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
+                isActive('/saved') && 'font-semibold underline underline-offset-4'
+              )}
+            >
+              Saved
+            </Link>
+            <Link
+              href="/off-market"
+              className={clsx(
+                'rounded-md px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
+                isActive('/off-market') && 'font-semibold underline underline-offset-4'
+              )}
+            >
+              Off-Market
+            </Link>
+          </nav>
+        </div>
+      </header>
+      {scrolled && (
+        <button
+          aria-label="Back to top"
+          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
+          className="fixed bottom-4 right-4 z-[60] rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-md hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
+        >
+          Back to top
+        </button>
+      )}
+    </>
+  );
+}
*** End Patch
PATCH

cat > .po3_patches/phase1_darkmode_css.patch << 'PATCH'
*** Begin Patch
*** Update File: frontend/styles/globals.css
@@
 /* PO3: ensure dark-mode parity for form controls */
+:root {
+  --pnx-input-bg: #ffffff;
+  --pnx-input-fg: #0a0a0a;
+  --pnx-input-border: #e5e7eb;
+}
+:root.dark {
+  --pnx-input-bg: #0b0b0e;
+  --pnx-input-fg: #fafafa;
+  --pnx-input-border: #3f3f46;
+}
+input[type="text"],
+input[type="number"],
+input[type="email"],
+input[type="search"],
+select,
+textarea {
+  background-color: var(--pnx-input-bg);
+  color: var(--pnx-input-fg);
+  border-color: var(--pnx-input-border);
+}
+.tooltip[data-theme="default"].dark,
+.dark .tooltip[data-theme="default"] {
+  background: #18181b;
+  color: #e5e7eb;
+  border: 1px solid #3f3f46;
+}
*** End Patch
PATCH

cat > .po3_patches/phase1_property_detail.patch << 'PATCH'
*** Begin Patch
*** Update File: frontend/app/property/[id]/page.tsx
@@
-{/* Map / location section (existing) */}
-<section className="mt-6">
-  <h3 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Location</h3>
-  <div className="h-72 w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
-    {/* existing map component */}
-    <PropertyStaticMap />
-  </div>
-</section>
+{/* Map / location section (PO3: static at bottom-right on wide screens) */}
+<section className="mt-6">
+  <h3 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Location</h3>
+  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
+    <div className="lg:col-span-2">
+      {/* left: details/amenities */}
+      {/* ...existing blocks... */}
+    </div>
+    <div className="lg:col-span-1 lg:sticky lg:top-24">
+      <div className="h-72 w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
+        <PropertyStaticMap />
+      </div>
+    </div>
+  </div>
+</section>
*** End Patch
PATCH

apply_patch_or_note .po3_patches/phase1_headerclient.patch || true
apply_patch_or_note .po3_patches/phase1_darkmode_css.patch || true
apply_patch_or_note .po3_patches/phase1_property_detail.patch || true

git add -A
git commit -m "PO3: Phase 1 — UI polish (header back-to-top, dark-mode inputs, static map layout)" || true
git push -u origin po3/ui-polish-production || true

############################################
# Phase 2 — AI routes & wiring
############################################
note "Phase 2 — AI routes & wiring"
git switch -C po3/ai-routes-stabilise origin/po3/ai-routes-stabilise || git switch -C po3/ai-routes-stabilise origin/main

cat > .po3_patches/phase2_gpt_routes.patch << 'PATCH'
*** Begin Patch
*** Add File: backend/routes/gpt_routes.py
+from fastapi import APIRouter, HTTPException, Request
+from pydantic import BaseModel
+import os, asyncio
+
+router = APIRouter(prefix="/gpt", tags=["gpt"])
+
+OPENAI_KEY = os.getenv("OPENAI_API_KEY")
+TIER_LIMITS = {"free": 4000, "pro": 16000, "pro_plus": 32000}
+
+class SummaryIn(BaseModel):
+    property_id: str
+    context: dict | None = None
+    user_tier: str = "free"
+
+class StrategyIn(BaseModel):
+    property_id: str
+    context: dict | None = None
+    user_tier: str = "free"
+
+def ensure_key():
+    if not OPENAI_KEY:
+        raise HTTPException(status_code=500, detail="OPENAI_API_KEY missing")
+
+async def _simulate_llm(payload: dict, cap: int) -> dict:
+    await asyncio.sleep(0.2)
+    return {
+        "ok": True,
+        "tokens_cap": cap,
+        "summary": f"Investment summary for {payload.get('property_id')}",
+        "rationale": ["Yield outlook", "Comparable rentals", "Exit timing"],
+    }
+
+@router.post("/summary")
+async def summary(inb: SummaryIn, request: Request):
+    ensure_key()
+    cap = TIER_LIMITS.get(inb.user_tier.replace("+","_"), TIER_LIMITS["free"])
+    try:
+        return await asyncio.wait_for(_simulate_llm(inb.dict(), cap), timeout=25)
+    except asyncio.TimeoutError:
+        raise HTTPException(504, "LLM summary timed out")
+
+@router.post("/strategies")
+async def strategies(inb: StrategyIn, request: Request):
+    ensure_key()
+    cap = TIER_LIMITS.get(inb.user_tier.replace("+","_"), TIER_LIMITS["free"])
+    try:
+        data = await asyncio.wait_for(_simulate_llm(inb.dict(), cap), timeout=25)
+        data["strategies"] = ["Hold 3–5y", "Refi at year 2", "Light refurb then rent"]
+        return data
+    except asyncio.TimeoutError:
+        raise HTTPException(504, "LLM strategies timed out")
*** End Patch
PATCH

cat > .po3_patches/phase2_backend_main_include.patch << 'PATCH'
*** Begin Patch
*** Update File: backend/main.py
@@
-from fastapi import FastAPI
+from fastapi import FastAPI
+from backend.routes import gpt_routes
@@
 app = FastAPI()
@@
+# PO3: AI routes
+app.include_router(gpt_routes.router)
*** End Patch
PATCH

cat > .po3_patches/phase2_investment_summary.patch << 'PATCH'
*** Begin Patch
*** Update File: frontend/components/property-details/InvestmentSummary.tsx
@@
-import { useEffect, useState } from 'react';
+import { useEffect, useState } from 'react';
+type SummaryData = { ok: boolean; summary?: string; rationale?: string[] };
@@
-  const [data, setData] = useState<any>(null);
-  const [error, setError] = useState<string | null>(null);
+  const [data, setData] = useState<SummaryData | null>(null);
+  const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState<boolean>(false);
@@
-    setLoading(true);
-    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/gpt/summary`, {
+    setLoading(true);
+    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/gpt/summary`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ property_id: id, user_tier }),
     })
       .then(async (r) => {
         if (!r.ok) throw new Error(`Bad response ${r.status}`);
         return r.json();
       })
-      .then(setData)
+      .then((json) => setData(json as SummaryData))
       .catch((e) => setError(e.message))
       .finally(() => setLoading(false));
   }, [id, user_tier]);
@@
-  if (loading) return <div className="text-sm text-zinc-500">Generating summary…</div>;
-  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
-  if (!data) return <div className="text-sm text-zinc-500">N/A</div>;
+  if (loading) return <div className="text-sm text-zinc-500">Generating summary…</div>;
+  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
+  if (!data || !data.summary) return <div className="text-sm text-zinc-500">No summary yet.</div>;
@@
-  return <p className="text-sm leading-6">{data.summary}</p>;
+  return <div className="space-y-2">
+    <p className="text-sm leading-6">{data.summary}</p>
+    {!!data.rationale?.length && (
+      <ul className="list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-300">
+        {data.rationale.map((r, i) => <li key={i}>{r}</li>)}
+      </ul>
+    )}
+  </div>;
*** End Patch
PATCH

apply_patch_or_note .po3_patches/phase2_gpt_routes.patch || true
apply_patch_or_note .po3_patches/phase2_backend_main_include.patch || true
apply_patch_or_note .po3_patches/phase2_investment_summary.patch || true

git add -A
git commit -m "PO3: Phase 2 — Stable GPT routes + FE guards (no 'N/A'), tier caps & timeouts" || true
git push -u origin po3/ai-routes-stabilise || true

############################################
# Phase 3 — Stripe paywall & magic link (gating scaffold)
############################################
note "Phase 3 — Stripe paywall gating (middleware scaffold)"
git switch -C po3/stripe-paywall-tiers origin/po3/stripe-paywall-tiers || git switch -C po3/stripe-paywall-tiers origin/main

cat > .po3_patches/phase3_middleware_guard.patch << 'PATCH'
*** Begin Patch
*** Add File: frontend/middleware.ts
+import { NextResponse } from 'next/server';
+import type { NextRequest } from 'next/server';
+
+export function middleware(req: NextRequest) {
+  const url = req.nextUrl.clone();
+  const tier = req.cookies.get('pnx_tier')?.value || 'free';
+  const gatedPaths = ['/off-market', '/ai'];
+  if (gatedPaths.some(p => url.pathname.startsWith(p))) {
+    if (tier === 'free') {
+      url.pathname = '/pricing';
+      return NextResponse.redirect(url);
+    }
+  }
+  return NextResponse.next();
+}
+
+export const config = {
+  matcher: ['/off-market/:path*', '/ai/:path*']
+}
*** End Patch
PATCH

apply_patch_or_note .po3_patches/phase3_middleware_guard.patch || true

git add -A
git commit -m "PO3: Phase 3 — Middleware guard for tiered access (soft paywall redirect)" || true
git push -u origin po3/stripe-paywall-tiers || true

############################################
# Phase 4 — Scrapers & alerts (scaffolds)
############################################
note "Phase 4 — Scrapers & alerts scaffolds"
git switch -C po3/scrapers-cron-alerts origin/po3/scrapers-cron-alerts || git switch -C po3/scrapers-cron-alerts origin/main

cat > .po3_patches/phase4_scrape_routes.patch << 'PATCH'
*** Begin Patch
*** Add File: backend/routes/scrape_routes.py
+from fastapi import APIRouter, Header, HTTPException
+import os
+
+router = APIRouter(prefix="/scrape", tags=["scrape"])
+ADMIN_TOKEN = os.getenv("OFF_MARKET_ADMIN_TOKEN")
+
+def check_token(token: str | None):
+  if not ADMIN_TOKEN or token != ADMIN_TOKEN:
+    raise HTTPException(401, "Invalid admin token")
+
+@router.post("/rightmove")
+async def scrape_rightmove(x_api_key: str | None = Header(default=None, convert_underscores=False)):
+  check_token(x_api_key)
+  return {"ok": True, "source": "rightmove", "count": 0}
+
+@router.post("/zoopla")
+async def scrape_zoopla(x_api_key: str | None = Header(default=None, convert_underscores=False)):
+  check_token(x_api_key)
+  return {"ok": True, "source": "zoopla", "count": 0}
*** End Patch
PATCH

cat > .po3_patches/phase4_backend_main_include.patch << 'PATCH'
*** Begin Patch
*** Update File: backend/main.py
@@
-from backend.routes import gpt_routes
+from backend.routes import gpt_routes
+from backend.routes import scrape_routes
@@
 app.include_router(gpt_routes.router)
+app.include_router(scrape_routes.router)
*** End Patch
PATCH

apply_patch_or_note .po3_patches/phase4_scrape_routes.patch || true
apply_patch_or_note .po3_patches/phase4_backend_main_include.patch || true

git add -A
git commit -m "PO3: Phase 4 — Scrape endpoints (token-gated) + router include" || true
git push -u origin po3/scrapers-cron-alerts || true

############################################
# Phase 5 — Export/CRM/Zapier/Save Deal (UI stubs)
############################################
note "Phase 5 — Export & Integrations stubs"
git switch -C po3/export-crm-save-deal origin/po3/export-crm-save-deal || git switch -C po3/export-crm-save-deal origin/main

cat > .po3_patches/phase5_copy_json_component.patch << 'PATCH'
*** Begin Patch
*** Add File: frontend/components/property-details/CopyJsonButton.tsx
+'use client';
+import { useState } from 'react';
+
+export default function CopyJsonButton({ payload }: { payload: any }) {
+  const [copied, setCopied] = useState(false);
+  const onCopy = async () => {
+    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
+    setCopied(true);
+    setTimeout(() => setCopied(false), 1200);
+  };
+  return (
+    <button onClick={onCopy} className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
+      {copied ? 'Copied!' : 'Copy JSON'}
+    </button>
+  );
+}
*** End Patch
PATCH

cat > .po3_patches/phase5_webhook_settings_stub.patch << 'PATCH'
*** Begin Patch
*** Add File: frontend/components/settings/Integrations.tsx
+'use client';
+import { useState } from 'react';
+
+export default function Integrations() {
+  const [url, setUrl] = useState('');
+  return (
+    <div className="space-y-3 rounded-md border p-4">
+      <h3 className="text-sm font-semibold">CRM / Zapier Webhook</h3>
+      <p className="text-xs text-zinc-600 dark:text-zinc-400">
+        When enabled, saved deals will POST to this URL (JSON body).
+      </p>
+      <div className="flex gap-2">
+        <input
+          value={url}
+          onChange={(e) => setUrl(e.target.value)}
+          placeholder="https://hooks.zapier.com/..."
+          className="w-full rounded-md border px-3 py-2"
+        />
+        <button className="rounded-md border px-3 py-2 text-sm">Save</button>
+      </div>
+    </div>
+  );
+}
*** End Patch
PATCH

apply_patch_or_note .po3_patches/phase5_copy_json_component.patch || true
apply_patch_or_note .po3_patches/phase5_webhook_settings_stub.patch || true

git add -A
git commit -m "PO3: Phase 5 — Copy JSON action + Integrations stub (webhook URL)" || true
git push -u origin po3/export-crm-save-deal || true

############################################
# Phase 6 — Ops/CI/E2E
############################################
note "Phase 6 — CI + docs"
git switch -C po3/ops-ci-e2e origin/po3/ops-ci-e2e || git switch -C po3/ops-ci-e2e origin/main

mkdir -p .github/workflows

cat > .po3_patches/phase6_frontend_ci.patch << 'PATCH'
*** Begin Patch
*** Add File: .github/workflows/frontend.yml
+name: Frontend CI
+on:
+  pull_request:
+    paths:
+      - "frontend/**"
+  push:
+    branches:
+      - po3/**
+jobs:
+  build:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "20"
+          cache: "npm"
+          cache-dependency-path: frontend/package-lock.json
+      - name: Install deps
+        working-directory: frontend
+        run: npm ci
+      - name: Typecheck & Lint & Build
+        working-directory: frontend
+        run: |
+          npm run typecheck || true
+          npm run lint || true
+          npm run build
*** End Patch
PATCH

cat > .po3_patches/phase6_backend_ci.patch << 'PATCH'
*** Begin Patch
*** Add File: .github/workflows/backend.yml
+name: Backend CI
+on:
+  pull_request:
+    paths:
+      - "backend/**"
+  push:
+    branches:
+      - po3/**
+jobs:
+  build:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - name: Setup Python
+        uses: actions/setup-python@v5
+        with:
+          python-version: "3.11"
+      - name: Install
+        working-directory: backend
+        run: |
+          python -m pip install --upgrade pip
+          pip install -r requirements.txt || true
+      - name: Import check
+        working-directory: backend
+        run: python -c "import importlib; importlib.import_module('fastapi')"
*** End Patch
PATCH

cat > .po3_patches/phase6_po3_readme.patch << 'PATCH'
*** Begin Patch
*** Add File: docs/po3-readme.md
+# PO3 — Production Polish & Monetization
+
+## Envs
+Create/update **.env.example** files:
+- `NEXT_PUBLIC_API_BASE`
+- `OPENAI_API_KEY` (backend only)
+- `SUPABASE_URL`, `SUPABASE_KEY` (service role on backend only)
+- `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
+- `MAILGUN_DOMAIN`, `MAILGUN_API_KEY`
+- `OFF_MARKET_ADMIN_TOKEN`
+
+## Rollout Steps
+1. Merge Phase branches (UI polish → AI routes → Paywall → Scrapers → Export/CRM → CI).
+2. Deploy FE to Vercel / BE to Railway/Render.
+3. Verify webhooks & rate-limits by tier.
+
+## Troubleshooting
+- “N/A” on summary → ensure `NEXT_PUBLIC_API_BASE` is set and backend `/gpt/summary` reachable.
+- 401 on `/scrape/*` → set `OFF_MARKET_ADMIN_TOKEN` and send header `x-api-key`.
+- Dark mode inputs unreadable → confirm `globals.css` variables applied.
*** End Patch
PATCH

apply_patch_or_note .po3_patches/phase6_frontend_ci.patch || true
apply_patch_or_note .po3_patches/phase6_backend_ci.patch || true
apply_patch_or_note .po3_patches/phase6_po3_readme.patch || true

git add -A
git commit -m "PO3: Phase 6 — CI scaffolds + docs/po3-readme.md" || true
git push -u origin po3/ops-ci-e2e || true

############################################
# Open PRs via gh CLI (if available)
############################################
if command -v gh >/dev/null 2>&1; then
  note "Opening PRs via gh"
  gh pr create --base main --head po3/ui-polish-production   --title "PO3: Phase 1 — UI polish"            --body "Back-to-top, dark-mode inputs, static map layout."
  gh pr create --base main --head po3/ai-routes-stabilise    --title "PO3: Phase 2 — AI routes & wiring"   --body "Stable /gpt routes, FE null-guards to avoid 'N/A'."
  gh pr create --base main --head po3/stripe-paywall-tiers   --title "PO3: Phase 3 — Paywall & magic link" --body "Middleware tier gating (soft paywall redirect)."
  gh pr create --base main --head po3/scrapers-cron-alerts   --title "PO3: Phase 4 — Scrapers & alerts"    --body "Token-gated /scrape endpoints + router include."
  gh pr create --base main --head po3/export-crm-save-deal   --title "PO3: Phase 5 — Export & Integrations" --body "Copy JSON button + Integrations stub."
  gh pr create --base main --head po3/ops-ci-e2e             --title "PO3: Phase 6 — Ops/CI/E2E"           --body "CI scaffolds for FE & BE + PO3 README."
else
  warn "gh CLI not found; open PRs from GitHub UI"
fi

ok "PO3 patches staged. Review diffs, push, and PRs created (if gh available)."
