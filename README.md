![Frontend CI](https://github.com/mohammed1210/propnexus-platform/actions/workflows/frontend-ci.yml/badge.svg)
![Backend CI](https://github.com/mohammed1210/propnexus-platform/actions/workflows/backend-ci.yml/badge.svg)

## Stripe env wiring (Vercel -> Frontend)
- **STRIPE_SECRET_KEY** (Secret) — set in Vercel (Production + Preview).
- **NEXT_PUBLIC_APP_BASE_URL** (Var) — e.g. https://propnexus-platform.vercel.app
- **NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS** (Var) — comma-separated price IDs, e.g.:
  `price_1SKIBTRvsQUM0wWd1P0WWjCz,price_1SNDCSRvsQUM0wWd5c5RaJiA`

## Webhook
- Stripe → Railway endpoint: `https://<railway-backend>/stripe/webhook`
- Events: checkout.session.completed, customer.subscription.{created,updated,deleted}
