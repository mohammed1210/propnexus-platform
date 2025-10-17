import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error('Missing required environment variable STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecret, {
  typescript: true,
});

export default stripe;
