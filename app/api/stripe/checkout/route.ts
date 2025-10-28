import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export async function POST(req: Request) {
  try {
    const { priceId, email } = await req.json().catch(() => ({ priceId: undefined, email: undefined }));

    // ----- allow-list validation (env may be CSV of price IDs)
    // Prefer a single CSV env so Pro/Investor can both be allowed here.
    const allowed = (process.env.NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!priceId || !allowed.includes(priceId)) {
      return NextResponse.json(
        { error: 'Invalid or missing priceId' },
        { status: 400 }
      );
    }

    // ----- origin base (success/cancel)
    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      billing_address_collection: 'auto',
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancelled`,
      automatic_tax: { enabled: true },
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
