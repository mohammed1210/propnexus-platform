const path = require('path');

const nextConfig = {
  reactStrictMode: false,
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(__dirname, '.');
    config.resolve.alias['@components'] = path.resolve(__dirname, 'components');
    config.resolve.alias['@details'] = path.resolve(__dirname, 'components/property_details');
    config.resolve.alias['@map'] = path.resolve(__dirname, 'app');
    return config;
  },
};

module.exports = nextConfig;
