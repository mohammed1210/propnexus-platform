// frontend/jest.config.js
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

module.exports = createJestConfig(customJestConfig);

// CI: ignore Playwright e2e specs
module.exports = (module.exports || require("./jest.config.base") || {});
module.exports.testPathIgnorePatterns = (module.exports.testPathIgnorePatterns || []).concat(["<rootDir>/e2e/"]);
