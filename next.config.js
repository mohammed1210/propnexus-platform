/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack(config) {
    config.resolve.alias['@'] = require('path').resolve(__dirname, 'frontend');
    config.resolve.alias['@components'] = require('path').resolve(__dirname, 'frontend/components');
    config.resolve.alias['@details'] = require('path').resolve(__dirname, 'frontend/components/property_details');
    config.resolve.alias['@map'] = require('path').resolve(__dirname, 'frontend/src/app');
    return config;
  },
};

module.exports = nextConfig;
