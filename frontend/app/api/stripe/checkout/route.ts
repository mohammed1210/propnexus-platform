import { NextResponse } from 'next/server';
import stripe from '../../../../lib/stripe';

export async function POST() {
  if (!stripe) {
    return NextResponse.json({
      ok: false,
      message: 'Stripe not configured in this environment',
      url: 'https://checkout.stripe.com/test',
    });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!priceId) {
    return NextResponse.json(
      { error: 'Missing STRIPE_PRICE_ID', url: 'https://checkout.stripe.com/test' },
      { status: 200 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
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
      { status: 500 }
    );
  }
}
