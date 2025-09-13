// frontend/next.config.mjs
import { fileURLToPath } from 'url';
import path, { dirname, resolve } from 'path';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const nextConfig = {
  reactStrictMode: true,

  // Tell Next where the real workspace root is (one level up).
  // This silences the multiple lockfiles warning.
  outputFileTracingRoot: resolve(__dirname, '..'),

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // All paths relative to the FRONTEND folder
      '@components': resolve(__dirname, 'src/components'),
      '@details':    resolve(__dirname, 'src/components/property_details'),
      '@map':        resolve(__dirname, 'src/components/map'),
      '@lib':        resolve(__dirname, 'src/lib'),
      '@app':        resolve(__dirname, 'src/app'),
    };
    return config;
  },
};

export default nextConfig;