/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/e2e/',
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
