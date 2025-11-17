// Only runs in Next.js instrumentation phase
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/nextjs' as any) as any;
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
    });
  } catch (e) {
    console.warn('Sentry not available, skipping instrumentation');
  }
}
