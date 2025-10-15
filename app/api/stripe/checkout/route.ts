import { NextResponse } from 'next/server';
// server-only import
import stripe from '../../../../lib/stripe';

export async function POST() {
  const priceId = process.env.STRIPE_PRICE_ID;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!priceId || !publishableKey) {
    return NextResponse.json({
      url: 'https://checkout.stripe.com/test',
      error: 'Missing Stripe configuration; using test URL.',
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/pricing?canceled=1`,
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
