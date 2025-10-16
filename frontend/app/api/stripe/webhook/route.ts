import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import stripe from '../../../../lib/stripe';

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json(
      { ok: false, message: 'Stripe not configured in this environment' },
      { status: 200 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 200 });
  }

  const signature = headers().get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const body = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Checkout session completed:', event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Error verifying Stripe webhook', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}
