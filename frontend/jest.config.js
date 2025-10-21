const nextJest = require('next/jest');      // if you’re using @next/jest
const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: { '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest' },
};

module.exports = createJestConfig(customJestConfig);
