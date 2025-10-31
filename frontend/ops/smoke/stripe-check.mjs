// Lightweight CI smoke to ensure checkout + pages + webhook health
// Usage: node frontend/ops/smoke/stripe-check.mjs

const BASE = process.env.BASE_URL?.trim();
const KEY  = process.env.STRIPE_SECRET_KEY?.trim();
const ALLOWED = process.env.NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS?.trim();

if (!BASE)  throw new Error('Missing BASE_URL env. Set repo var RELEASE_BASE_URL.');
if (!ALLOWED) throw new Error('Missing NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS repo var.');
if (!KEY)   console.warn('⚠️ STRIPE_SECRET_KEY missing – not required for this smoke, continuing…');

const priceIds = ALLOWED.split(',').map(s => s.trim()).filter(Boolean);
if (!priceIds.length) throw new Error('No price IDs parsed from NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS.');

async function get(url, init) {
  const res = await fetch(url, { ...init, redirect: 'manual' });
  return res;
}
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
    redirect: 'manual',
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  return { res, data };
}
function expect(cond, message) {
  if (!cond) throw new Error(message);
}

(async () => {
  console.log(`ℹ️ Base: ${BASE}`);
  console.log(`ℹ️ Prices: ${priceIds.join(', ')}`);

  // 1) Pricing page exists
  {
    const res = await get(`${BASE}/pricing`);
    expect(res.status >= 200 && res.status < 400, `Pricing page not OK: ${res.status}`);
    console.log('✅ /pricing renders');
  }

  // 2) For each price, our checkout endpoint returns a Stripe checkout URL
  for (const pid of priceIds) {
    const { res, data } = await postJSON(`${BASE}/api/stripe/checkout`, { priceId: pid });
    expect(res.status === 200, `Checkout API non-200 for ${pid}: ${res.status}`);
    expect(typeof data?.url === 'string' && data.url.includes('checkout.stripe.com'),
      `Missing/invalid checkout URL for ${pid}: ${JSON.stringify(data)}`);
    console.log(`✅ /api/stripe/checkout works for ${pid}`);
  }

  // 3) Success & cancel pages render
  for (const path of ['/billing/success', '/billing/cancel']) {
    const res = await get(`${BASE}${path}`);
    expect(res.status >= 200 && res.status < 400, `${path} not OK: ${res.status}`);
    console.log(`✅ ${path} renders`);
  }

  // 4) Webhook “health” ping (optional): supports GET ?health=1, otherwise warn
  {
    const healthUrl = `${BASE}/api/stripe/webhook?health=1`;
    const res = await get(healthUrl);
    if (res.status >= 200 && res.status < 400) {
      console.log('✅ Webhook health passes (GET ?health=1 returns OK)');
    } else {
      console.warn(`⚠️ Webhook health endpoint not detected (${res.status}). 
Add a GET handler that returns 200 for ?health=1 to silence this warning.`);
    }
  }

  // 5) Customer portal endpoint (best-effort)
  {
    const { res } = await postJSON(`${BASE}/api/stripe/portal`, {});
    if (res.status === 200) {
      console.log('✅ /api/stripe/portal responded 200 (URL checked by app code)');
    } else {
      console.warn(`⚠️ /api/stripe/portal returned ${res.status} – acceptable if no stored customer id yet.`);
    }
  }

  console.log('🎉 Stripe smoke completed OK');
})().catch(err => {
  console.error('❌ Stripe smoke failed:', err.message || err);
  process.exit(1);
});
