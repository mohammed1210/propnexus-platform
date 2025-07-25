/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias['@'] = require('path').resolve(__dirname, 'src');
    config.resolve.alias['@components'] = require('path').resolve(__dirname, 'src/components');
    config.resolve.alias['@details'] = require('path').resolve(__dirname, 'src/components/property_details');
    config.resolve.alias['@map'] = require('path').resolve(__dirname, 'src/app');
    config.resolve.alias['@lib'] = require('path').resolve(__dirname, 'src/lib');
    return config;
  },
};

module.exports = nextConfig;