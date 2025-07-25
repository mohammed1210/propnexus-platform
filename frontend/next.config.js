const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'components'), // ✅ FIXED
      '@details': path.resolve(__dirname, 'components/property_details'), // ✅ FIXED
      '@map': path.resolve(__dirname, 'src/app'),
      '@lib': path.resolve(__dirname, 'lib'),
    };
    return config;
  },
};

module.exports = nextConfig;