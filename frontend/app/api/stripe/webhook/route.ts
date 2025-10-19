import { NextResponse } from 'next/server';
import stripe from '@/lib/stripe';

export const runtime = 'nodejs'; // ensure Node runtime for webhooks

export async function POST(req: Request) {
  if (!stripe) {
    // In preview/CI we just acknowledge so the endpoint is idempotent
    return NextResponse.json({ received: true, skipped: 'no-stripe' });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing webhook config' }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: handle subscription activation
        break;
      // Add other event types as needed
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('stripe webhook', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
