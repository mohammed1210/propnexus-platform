import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover', // or keep '2024-06-20' with ts-ignore
});

export async function POST(req: Request) {
  try {
    const { priceId } = await req.json();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing/cancel`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Stripe session creation failed' }, { status: 500 });
  }
}
