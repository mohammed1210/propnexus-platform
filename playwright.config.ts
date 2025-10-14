import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  testDir: '.',
  testIgnore: [],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});
