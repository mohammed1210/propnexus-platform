/**
 * Optional Sentry edge init. Safe to skip if @sentry/nextjs is absent.
 */

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sentry = require('@sentry/nextjs');

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.15,
  });
} catch (err) {
  console.warn('[sentry] edge init skipped:', (err as Error)?.message ?? err);
}
