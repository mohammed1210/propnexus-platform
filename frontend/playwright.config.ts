import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || process.env.E2E_PORT || 3050);
const HOST = process.env.HOST || '127.0.0.1';
const BASE = process.env.E2E_BASE_URL || `http://${HOST}:${PORT}`;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

// Check if we're running screenshot tests
const isScreenshotTest = process.env.SCREENSHOT_TEST === 'true';

export default defineConfig({
  testDir: isScreenshotTest ? './tests' : './e2e',
  fullyParallel: true,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: isScreenshotTest ? 'http://127.0.0.1:3000' : BASE,
    trace: 'on-first-retry',
    colorScheme: isScreenshotTest ? 'dark' : undefined,
  },
  webServer: {
    command: isScreenshotTest
      ? 'npm run build && npm run start'
      : `NEXT_PUBLIC_API_BASE="${API_BASE}" npx next build && npx next start -H ${HOST} -p ${PORT}`,
    url: isScreenshotTest ? 'http://127.0.0.1:3000' : BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
