const path = require('path');

const nextConfig = {
  reactStrictMode: false,
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(__dirname, 'frontend/src');
    config.resolve.alias['@components'] = path.resolve(__dirname, 'frontend/components');
    config.resolve.alias['@details'] = path.resolve(__dirname, 'frontend/components/property_details');
    config.resolve.alias['@map'] = path.resolve(__dirname, 'frontend/src/app');
    return config;
  }
};

module.exports = nextConfig;
