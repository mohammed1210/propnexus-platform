// frontend/lib/stripe.ts
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY ?? '';

/**
 * Export a nullable client so builds don’t crash when secrets are absent.
 * Routes should guard with: if (!stripe) { ...fallback... }
 */
const stripe = secret
  ? new Stripe(secret, { /* rely on default API version */ typescript: true })
  : null;

export default stripe;
