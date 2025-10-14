import Stripe from 'stripe';

/**
 * Lazily instantiate the Stripe client when the secret key is available. This
 * file should only ever be imported from server code. If the required
 * environment variables are missing the Stripe client will not be created and
 * consumers should handle the thrown error accordingly. A specific API
 * version is pinned to avoid unexpected changes.
 */

const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
  throw new Error('Missing required environment variable STRIPE_SECRET_KEY');
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export default stripe;
