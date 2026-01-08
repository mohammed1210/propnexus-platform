/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',

  testMatch: ['**/__tests__/**/*.(test|spec).tsx?', '**/*.spec.tsx'],
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/.next/', '<rootDir>/node_modules/'],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest'],
  },

  transformIgnorePatterns: [
    '/node_modules/(?!(?:@clerk)/)'
  ],
  
  moduleNameMapper: {
    // ✅ Add support for Next.js alias '@/'
    '^@/(.*)$': '<rootDir>/$1',

    // CSS Modules / global CSS
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',

    // Images → your file mock
    '\\.(jpg|jpeg|png|gif|webp|avif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  verbose: false,
  collectCoverage: false,
};
