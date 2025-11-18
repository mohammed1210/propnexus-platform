import { test, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

// Ensure screenshot directory exists before running tests
test.beforeAll(async () => {
  const screenshotDir = join(
    process.cwd(),
    'public',
    'images',
    'demo',
    'screenshots'
  );
  await mkdir(screenshotDir, { recursive: true });
});

test.describe('Demo Screenshots', () => {
  test('capture demo landing page screenshot', async ({ page }) => {
    // Navigate to demo page
    await page.goto('/demo');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take full-page screenshot
    await page.screenshot({
      path: 'public/images/demo/screenshots/demo-landing.png',
      fullPage: true,
    });

    // Soft assertion - we want to capture what's there even if content is missing
    await expect.soft(page.locator('h1')).toBeVisible();
  });

  test('capture premium demo 1 screenshot', async ({ page }) => {
    // Navigate to demo property 1
    await page.goto('/demo/property/demo-1');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take full-page screenshot
    await page.screenshot({
      path: 'public/images/demo/screenshots/premium-demo-1.png',
      fullPage: true,
    });

    // Soft assertion - capture whatever is rendered
    await expect.soft(page.locator('body')).toBeVisible();
  });

  test('capture premium demo 2 screenshot', async ({ page }) => {
    // Navigate to demo property 2
    await page.goto('/demo/property/demo-2');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take full-page screenshot
    await page.screenshot({
      path: 'public/images/demo/screenshots/premium-demo-2.png',
      fullPage: true,
    });

    // Soft assertion - capture whatever is rendered
    await expect.soft(page.locator('body')).toBeVisible();
  });

  test('capture premium demo 3 screenshot', async ({ page }) => {
    // Navigate to demo property 3
    await page.goto('/demo/property/demo-3');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take full-page screenshot
    await page.screenshot({
      path: 'public/images/demo/screenshots/premium-demo-3.png',
      fullPage: true,
    });

    // Soft assertion - capture whatever is rendered
    await expect.soft(page.locator('body')).toBeVisible();
  });
});
