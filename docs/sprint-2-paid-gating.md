# Sprint 2 Paid Deal Pack Gating

Sprint 2 adds the first paid gating layer for Deal Desk outputs without changing the backend subscription schema. The backend still stores `free`, `pro`, and `investor`. The frontend remaps those plans to launch-facing tiers.

## Launch pricing

- Free: `£0/month`
- Investor Starter: `£9/month` launch price, later `£19/month`
- Investor Pro: `£19/month` launch price, later `£39/month`
- Sourcer Pro: `£39/month` launch price, later `£79/month` and still coming soon

Founding member copy:

> Founding member pricing available for early users. Prices may increase as PropNexus adds more data, Deal Pack features and integrations.

## Plan mapping

- Backend `free` -> launch `Free`
- Backend `pro` -> launch `Investor Starter`
- Backend `investor` -> launch `Investor Pro`

This keeps Stripe webhook and backend plan persistence unchanged for Sprint 2.

## Feature gates

### Free

- Basic pricing page access
- Basic yield and evidence preview in Offer Intelligence
- Deal Pack preview page remains reachable by direct route
- No full offer range
- No PDF export
- No full Deal Pack

### Investor Starter

- Full Deal Label naming in the launch copy layer
- Indicative offer range when rent evidence is strong enough
- Saved deals workspace
- No PDF export
- No full Deal Pack printable output
- No finance stress-test

### Investor Pro

- Full offer range
- Full Deal Pack page output
- PDF export route access
- Finance stress-test positioning in plan copy
- Full printable underwriting workflow

### Sourcer Pro

- Pricing card only
- No checkout implementation shipped in Sprint 2
- No branded sourcer reports shipped in Sprint 2

## Required Stripe env vars

Frontend launch pricing reads only public Stripe ids:

- `NEXT_PUBLIC_STRIPE_PRICE_PRO`
- `NEXT_PUBLIC_STRIPE_PRODUCT_PRO`
- `NEXT_PUBLIC_STRIPE_PRICE_INVESTOR`
- `NEXT_PUBLIC_STRIPE_PRODUCT_INVESTOR`
- `NEXT_PUBLIC_STRIPE_PRICE_SOURCER_PRO` optional for future use
- `NEXT_PUBLIC_STRIPE_PRODUCT_SOURCER_PRO` optional for future use

Backend checkout and webhook behavior still depend on the existing server env vars:

- `STRIPE_PRICE_PRO`
- `STRIPE_PRODUCT_PRO`
- `STRIPE_PRICE_INVESTOR`
- `STRIPE_PRODUCT_INVESTOR`
- `STRIPE_SECRET_KEY`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `STRIPE_PORTAL_RETURN_URL`

## Notes

- `/property/[id]/deal-pack` now shows a preview for non-Pro users instead of failing closed.
- `/api/property-pdf/[id]` is server-gated and returns `403 upgrade_required` unless the user has Investor Pro entitlements.
- Manual deals remain reachable by direct property URL.
- This sprint does not change the `/analyse` legal sentence.

## Deferred work

### Sprint 2B

- Usage credits
- Metering and quota enforcement
- Any credit wallet or balance UX

### Sprint 3

- Sourcer Pro branded reports
- Client-ready sourcer exports
- Sourcer branding workflows
