// frontend/next.config.mjs
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig = {
  reactStrictMode: true,

  // Silence multiple-lockfiles warning in monorepos
  outputFileTracingRoot: resolve(__dirname, '..'),

  // Be permissive during development; tighten if you want later.
  images: {
    // Wildcard is convenient for mixed sources (Unsplash, Cloudinary, etc.)
    // For production hardening, replace with explicit host list or remotePatterns.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // All paths relative to the FRONTEND folder
      '@components': resolve(__dirname, 'components'),
      '@details': resolve(__dirname, 'components/property_details'),
      '@MapView': resolve(__dirname, 'components/MapView'),
      '@lib': resolve(__dirname, 'lib'),
      '@': resolve(__dirname, '.'), // allow imports like "@/lib/supabaseClient"
    };
    return config;
  },
};

// Only enable Sentry in production when DSN is configured
// In dev/test, skip Sentry wrappers to avoid overhead and false events
const useSentry =
  process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN;

let exportedConfig = nextConfig;

if (useSentry) {
  try {
    const { withSentryConfig } = await import('@sentry/nextjs');
    exportedConfig = withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    });
  } catch (err) {
    console.warn('[next.config] Sentry wrapper skipped:', err?.message ?? err);
  }
}

export default exportedConfig;
