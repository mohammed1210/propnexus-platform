const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Remote image handling (fixes Next/Image 400 errors)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'frontend/components'),
      '@details': path.resolve(__dirname, 'frontend/components/property-details'),
      '@map': path.resolve(__dirname, 'frontend/src/app'),
      '@lib': path.resolve(__dirname, 'frontend/src/lib'),
    };
    return config;
  },
};

module.exports = nextConfig;