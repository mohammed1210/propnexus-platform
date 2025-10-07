// frontend/next.config.mjs
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const nextConfig = {
  reactStrictMode: true,

  // Silence multiple-lockfiles warning in monorepos
  outputFileTracingRoot: resolve(__dirname, '..'),

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // All paths relative to the FRONTEND folder
      '@components': resolve(__dirname, 'components'),
      '@details':    resolve(__dirname, 'components/property_details'),
      '@MapView':        resolve(__dirname, 'components/MapView'),
      '@lib':        resolve(__dirname, 'lib'),
      '@':           resolve(__dirname, '.'), // allow imports like "@/lib/supabaseClient"
    };
    return config;
  },
};

export default nextConfig;
