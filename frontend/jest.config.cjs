/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Use ts-jest to transpile TS/TSX in tests
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    // support "@/..." imports -> "<rootDir>/..."
    '^@/(.*)$': '<rootDir>/$1',
    // stub style imports if any
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
  // keeps node_modules untouched except packages we may need to transform
  transformIgnorePatterns: [
    '/node_modules/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
};
