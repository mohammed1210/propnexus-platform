import { NextResponse } from 'next/server';
import stripe, { Stripe } from '../../../../lib/stripe';

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for a subscription.
 * Returns a structured JSON payload: { url } or { error }.
 */
export async function POST() {
  const priceId = process.env.STRIPE_PRICE_ID;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Safeguard for CI/preview: if anything important is missing, return a harmless test URL.
  if (!priceId || !publishableKey || !stripe) {
    return NextResponse.json(
      {
        url: 'https://checkout.stripe.com/test',
        note:
          'Missing Stripe configuration in this environment; returned a test URL instead.',
      },
      { status: 200 },
    );
  }

  try {
    // After the guard, coerce to non-null for this scope.
    const s = stripe as Stripe;
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
