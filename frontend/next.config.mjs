// frontend/next.config.mjs
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { withSentryConfig } from '@sentry/nextjs';

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

export default withSentryConfig(nextConfig, { silent: true }, { widenClientFileUpload: true });
