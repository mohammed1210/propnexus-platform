import { NextResponse } from 'next/server';
import stripe from '@/lib/stripe';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? '';

export async function POST(req: Request) {
  const { priceId } = await req.json();

  if (!stripe) {
    // No server secret in this environment – report a clear 503
    return NextResponse.json(
      { error: 'Stripe is not configured in this environment.' },
      { status: 503 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    console.error('stripe checkout create', err);
    return NextResponse.json(
      { error: err?.message ?? 'Stripe error' },
      { status: 500 }
    );
  }
}
