/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',

  // Only unit/integration tests (exclude Playwright e2e)
  testMatch: ['**/__tests__/**/*.(test|spec).tsx?', '**/*.spec.tsx'],
  testPathIgnorePatterns: [
    '<rootDir>/e2e/',
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // 🔽 Transform TS/TSX/JS/JSX via babel-jest + next/babel
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { rootMode: 'upward' }],
  },

  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|avif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  verbose: false,
  collectCoverage: false,
};
