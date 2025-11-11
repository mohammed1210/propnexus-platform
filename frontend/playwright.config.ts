import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || process.env.E2E_PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const BASE = process.env.E2E_BASE_URL || `http://${HOST}:${PORT}`;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
// Default to dev server for local runs; set PW_USE_DEV=0 to force production server
const USE_DEV = process.env.PW_USE_DEV === '0' ? false : true;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 30_000,
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },
  webServer: {
    command: USE_DEV
      ? `NEXT_PUBLIC_API_BASE="${API_BASE}" npx next dev -H ${HOST} -p ${PORT}`
      : `NEXT_PUBLIC_API_BASE="${API_BASE}" npx next start -H ${HOST} -p ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
