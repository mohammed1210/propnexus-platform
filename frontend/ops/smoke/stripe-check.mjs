import assert from 'node:assert';

const base = process.env.NEXT_PUBLIC_APP_BASE_URL;
const allowed = (process.env.NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS || '')
  .split(',').map(s=>s.trim()).filter(Boolean);

assert(base, 'NEXT_PUBLIC_APP_BASE_URL missing');
assert(allowed.length >= 1, 'No allowed price IDs configured');

const hit = async (priceId) => {
  const r = await fetch(`${base}/api/stripe/checkout`, {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body: JSON.stringify({ priceId })
  });
  const j = await r.json();
  if (!r.ok || !j?.url) throw new Error(`Checkout failed for ${priceId}: ${j?.error || r.statusText}`);
  console.log('✅ checkout ok', priceId, '→', j.url.slice(0,80)+'…');
};

for (const pid of allowed) {
  // only test first two to keep CI fast
  await hit(pid);
  if (allowed.indexOf(pid) === 1) break;
}
console.log('✅ stripe-check complete');
