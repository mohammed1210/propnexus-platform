import { NextResponse } from 'next/server';
// server-only import
import stripe, { Stripe as StripeSDK } from '../../../../lib/stripe';

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for a subscription.
 * Returns { url } or a harmless fallback when Stripe isn't configured.
 */
export async function POST() {
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Missing config? Return a safe deterministic URL so the app still works in preview/CI.
  if (!priceId || !stripe) {
    return NextResponse.json({
      url: 'https://checkout.stripe.com/test',
      note: 'Stripe not configured; using test URL.',
    });
  }

  // `stripe` is narrowed via the guard above; keep TS happy explicitly as well.
  const s = stripe as StripeSDK;

  try {
    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Error creating Stripe checkout session', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error creating Stripe checkout session' },
      { status: 500 },
    );
  }
}
