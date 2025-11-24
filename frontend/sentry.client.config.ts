/**
 * Optional Sentry client init. Only enabled in production when DSN is configured.
 * Disabled in development and test environments to prevent false events.
 */

if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_SENTRY_DSN
) {
  try {
    const Sentry = require('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.15,
      environment: process.env.NODE_ENV,
    });
  } catch (err) {
    // Keep builds green even if Sentry isn't available
    console.warn('[sentry] client init skipped:', (err as Error)?.message ?? err);
  }
} else {
  console.log('[sentry] client init skipped (dev/test mode or no DSN)');
}
