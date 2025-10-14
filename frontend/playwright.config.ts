import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.spec.ts'],
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },
  // no webServer block — you’re starting Next manually
  projects: [
    {
      name: 'Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
