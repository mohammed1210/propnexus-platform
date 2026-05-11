# Top Deal Ranking launch checks

- [ ] Apply `supabase/migrations/20260510_top_deal_ranking.sql` before relying on DB-level `sort=top_deals` in production.
- [ ] Run a fresh import and confirm returned rows include `top_deal_score`, `top_deal_tier`, and `top_deal_reasons`.
- [ ] Confirm no BMV/below-market copy appears unless `data.top_deal.evidence.sold_comps` is present.
- [ ] Confirm `/listings?sort=top_deals` returns `200` and shows Top Deal badges where evidence exists.

# Go-Live PASS/FAIL Checklist

This is a strict go-live checklist. Every step has a command, a PASS condition, and what to do if it FAILs.

## 0) Prereqs (one-time)

### Load env (Codespaces/devcontainer)

Command:

```bash
source scripts/codespaces_env.sh
```

PASS:
- Prints `BACKEND_URL=...`
- Prints `ADMIN_TOKEN=<set>`

FAIL → Next action:
- Create `.env.codespaces` or `.env.local` with `BACKEND_URL=...` and `ADMIN_TOKEN=...`, or create a local `.admin_token` file.

## 1) Environment configured

PASS:
- Railway backend has `IMPORT_ADMIN_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and (if using ScraperAPI) `SCRAPERAPI_KEY`.
- Vercel frontend has `NEXT_PUBLIC_API_BASE` pointing at Railway backend.

FAIL → Next action:
- Set missing env vars in Railway/Vercel and redeploy.

## 2) Backend health

Command:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$BACKEND_URL/health"
```

PASS:
- Output is `200`

FAIL → Next action:
- Check Railway logs for startup errors and confirm env vars are present.

## 3) Admin token gating

Command (missing token):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$BACKEND_URL/import/all?req=London"
```

PASS:
- Output is `401` when `IMPORT_ADMIN_TOKEN` is set in production

FAIL → Next action:
- Confirm `IMPORT_ADMIN_TOKEN` is set on Railway and the backend is redeployed.

Command (with token):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$BACKEND_URL/import/all?req=London" \
	-H "x-admin-token: $ADMIN_TOKEN"
```

PASS:
- Output is `200`

FAIL → Next action:
- Verify `$ADMIN_TOKEN` matches Railway `IMPORT_ADMIN_TOKEN` exactly (no whitespace/newlines).

## 4) Imports (expect non-zero for Zoopla/OTM/SpareRoom)

NOTE:
- Rightmove may be `0` until the ScraperAPI pool issue is resolved.
- Zoopla / OnTheMarket / SpareRoom should be `> 0` for at least one known-good location.

### Zoopla

Command:

```bash
curl -sS -X POST "$BACKEND_URL/import/zoopla" \
	-H "x-admin-token: $ADMIN_TOKEN" \
	-H "content-type: application/json" \
	-d '{"location":"London"}'
```

PASS:
- Response JSON contains `"count"` and it is `> 0`

FAIL → Next action:
- Run the probe endpoint (Step 6) and check for blocking/timeouts.

### OnTheMarket

Command:

```bash
curl -sS -X POST "$BACKEND_URL/import/onthemarket" \
	-H "x-admin-token: $ADMIN_TOKEN" \
	-H "content-type: application/json" \
	-d '{"location":"London"}'
```

PASS:
- Response JSON contains `"count"` and it is `> 0`

FAIL → Next action:
- Run the probe endpoint (Step 6) and check for blocking/timeouts.

### SpareRoom

Command:

```bash
curl -sS -X POST "$BACKEND_URL/import/spareroom" \
	-H "x-admin-token: $ADMIN_TOKEN" \
	-H "content-type: application/json" \
	-d '{"location":"Birmingham"}'
```

PASS:
- Response JSON contains `"count"` and it is `> 0`

FAIL → Next action:
- Run the probe endpoint (Step 6) and check for blocking/timeouts.

### Rightmove (known issue)

Command:

```bash
curl -sS -X POST "$BACKEND_URL/import/rightmove" \
	-H "x-admin-token: $ADMIN_TOKEN" \
	-H "content-type: application/json" \
	-d '{"location":"London"}'
```

PASS:
- Response is `200` and includes `"count"` (may be `0` currently)

FAIL → Next action:
- Confirm `SCRAPER_MODE` and `SCRAPERAPI_KEY` are set; run Step 6 probe.

## 5) Properties endpoint returns count > 0

Command:

```bash
curl -sS "$BACKEND_URL/properties?limit=50" \
	| /workspaces/propnexus-platform/.venv/bin/python - <<'PY'
import json,sys
data=json.load(sys.stdin)
print(len(data) if isinstance(data,list) else 0)
sys.exit(0 if isinstance(data,list) and len(data)>0 else 1)
PY
```

PASS:
- Command prints a number `> 0` and exits `0`

FAIL → Next action:
- Re-run Zoopla/OTM/SpareRoom imports; check Supabase table `properties` and Railway logs.

## 6) Debug scrape probe (diagnostics)

Command:

```bash
curl -sS "$BACKEND_URL/debug/scrape-probe?location=London&sources=zoopla,onthemarket,spareroom" \
	-H "x-admin-token: $ADMIN_TOKEN"
```

PASS:
- Response JSON has `"ok": true`
- Each requested source has `classification` of `parsed` (or `fetched_no_results` with an obvious explanation)

FAIL → Next action:
- If `blocked`: enable/verify ScraperAPI settings.
- If `timeout`: increase timeouts or reduce sources.

## 7) Frontend rendering (images + cards)

PASS:
- Listings page shows property cards from Zoopla/OTM/SpareRoom.
- Card images load (no broken `//...` URLs).

FAIL → Next action:
- Verify Step 5 returns items and that `imageurl`/`image_urls` are populated.

## 8) Stripe webhooks (production)

PASS:
- Stripe dashboard test event to `$BACKEND_URL/stripe/webhook` returns 2xx.
- At least one real event shows after a real checkout.
- Frontend `/api/stripe/webhook` remains disabled so there is no duplicate webhook owner.

FAIL → Next action:
- Check Railway logs and Stripe “Webhook Attempts”. Verify `STRIPE_WEBHOOK_SECRET`.

## 9) Rollback / mitigation

If go-live checks fail:
- Roll back Railway deploy to the previous successful release.
- Disable scraping features by setting `SCRAPER_MODE=direct` (temporary) and communicating limitations.
- If Rightmove is the only failure, proceed with Zoopla/OTM/SpareRoom while ScraperAPI investigates.
