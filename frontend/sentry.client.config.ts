/**
 * Optional Sentry client init. If @sentry/nextjs is not installed
 * (e.g. in CI or preview), we skip without failing the build.
 */

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sentry = require('@sentry/nextjs');

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.15,
  });
} catch (err) {
  // Keep builds green even if Sentry isn’t available
  console.warn('[sentry] client init skipped:', (err as Error)?.message ?? err);
}
