/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',

  // Only let Jest pick up unit/integration tests in __tests__/ (not e2e)
  testMatch: ['**/__tests__/**/*.(test|spec).tsx?', '**/*.spec.tsx'],

  // Ignore e2e (Playwright), build output, and node_modules
  testPathIgnorePatterns: [
    '<rootDir>/e2e/',
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],

  // Run after the environment but before each test file executes
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Transform TS/TSX with ts-jest (already in devDependencies)
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
  },

  // Stub CSS and files for Jest
  moduleNameMapper: {
    // CSS Modules / global CSS
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Images -> your existing mock
    '\\.(jpg|jpeg|png|gif|webp|avif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // Keep things speedy / quiet
  verbose: false,
  collectCoverage: false,
};
