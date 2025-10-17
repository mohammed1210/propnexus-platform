// frontend/app/api/stripe/webhook/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import stripe from '../../../../lib/stripe';

/**
 * POST /api/stripe/webhook
 * Verifies signature and acknowledges events.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // No Stripe or no webhook secret in Preview/CI — acknowledge and exit.
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ received: true, note: 'Webhook disabled in this env.' });
  }

  // Your type defs treat headers() as async -> await it
  const h = await headers();
  const signature = h.get('stripe-signature');
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
