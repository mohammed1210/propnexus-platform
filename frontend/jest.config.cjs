/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',

  // More robust matching (keeps your intent but removes edge-case misses)
  testMatch: [
    '<rootDir>/**/__tests__/**/*.(test|spec).[tj]s?(x)',
    '<rootDir>/**/*.(test|spec).[tj]s?(x)',
  ],

  testPathIgnorePatterns: [
    '<rootDir>/e2e/',
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest'],
  },

  // Allow Clerk to be transformed, ignore the rest of node_modules
  transformIgnorePatterns: ['/node_modules/(?!(?:@clerk)/)'],

  moduleNameMapper: {
    // ✅ Next.js alias '@/'
    '^@/(.*)$': '<rootDir>/frontend/$1',

    // CSS Modules / global CSS
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',

    // Images → file mock
    '\\.(jpg|jpeg|png|gif|webp|avif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  verbose: false,
  collectCoverage: false,

  // Helps avoid random CI flakiness
  testTimeout: 30000,
};
