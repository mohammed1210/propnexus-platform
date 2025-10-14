import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error('Missing required environment variable STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export default stripe;
