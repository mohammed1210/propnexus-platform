/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',

  // IMPORTANT: when this config sits in /frontend, <rootDir> is /frontend
  rootDir: '.',

  testMatch: ['**/__tests__/**/*.(test|spec).tsx?', '**/*.spec.tsx'],
  testPathIgnorePatterns: [
    '<rootDir>/e2e/',
    '<rootDir>/tests/', // ignore Playwright tests (TransformStream error)
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },

  transformIgnorePatterns: ['/node_modules/(?!(?:@clerk)/)'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|avif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  verbose: false,
  collectCoverage: false,
};
