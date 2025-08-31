const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Allow remote images (prevents 400s from Next/Image optimizer)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'components'),
      '@details': path.resolve(__dirname, 'components/property_details'),
      '@map': path.resolve(__dirname, 'src/app'),
      '@lib': path.resolve(__dirname, 'lib'),
    };
    return config;
  },
};

module.exports = nextConfig;
