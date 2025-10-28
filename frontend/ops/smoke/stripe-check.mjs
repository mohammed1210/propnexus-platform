// Minimal Stripe smoke: validate price IDs and create a short-lived Checkout Session (dry run)
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
const allowed = (process.env.NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);

if (!key) {
  console.error('❌ STRIPE_SECRET_KEY not set');
  process.exit(1);
}
if (!allowed.length) {
  console.error('❌ NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS empty');
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2025-09-30.clover' });

(async () => {
  try {
    // 1) Verify all price IDs exist
    for (const id of allowed) {
      const price = await stripe.prices.retrieve(id);
      if (!price?.active) throw new Error(`Price ${id} is not active`);
    }
    console.log(`✅ ${allowed.length} Stripe price IDs are valid & active`);

    // 2) Try a session (no redirect; just make sure creation works)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: allowed[0], quantity: 1 }],
      success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://example.com/cancel',
      automatic_tax: { enabled: true },
    });
    if (!session?.id) throw new Error('No session id returned');
    console.log('✅ Checkout session creation OK');
    process.exit(0);
  } catch (err) {
    console.error('❌ Stripe smoke failed:', err?.message || err);
    process.exit(1);
  }
})();
