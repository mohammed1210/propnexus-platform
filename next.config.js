const path = require('path');

const nextConfig = {
  reactStrictMode: false,
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(__dirname, 'frontend/src');
    config.resolve.alias['@components'] = path.resolve(__dirname, 'frontend/components');
    config.resolve.alias['@details'] = path.resolve(__dirname, 'frontend/components/property_details');
    config.resolve.alias['@map'] = path.resolve(__dirname, 'frontend/src/app');
    config.resolve.alias['@lib'] = path.resolve(__dirname, 'frontend/lib');
    return config;
  }
};

module.exports = nextConfig;
