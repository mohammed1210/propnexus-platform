import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { DEMO_PREMIUM_SCREENSHOT_PROPERTY_ID } from '../lib/demoContent';

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

async function openCollapsible(page: Page, title: string) {
  const trigger = page.getByRole('button', { name: new RegExp(title, 'i') });
  await trigger.scrollIntoViewIfNeeded();
  const expanded = await trigger.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await trigger.click();
  }
}

async function ensureLightMode(page: Page) {
  const themeToggle = page.getByTestId('theme-toggle');
  await expect(themeToggle).toBeVisible();

  const label = await themeToggle.getAttribute('aria-label');
  if (label?.toLowerCase().includes('switch to light mode')) {
    await themeToggle.click();
  }
}

async function openPropertyForScreenshot(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.goto(`/property/${DEMO_PREMIUM_SCREENSHOT_PROPERTY_ID}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await ensureLightMode(page);
}

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

  test('capture investment analytics preview', async ({ page }) => {
    await openPropertyForScreenshot(page);
    await openCollapsible(page, 'Investment Calculator');

    const calculator = page.locator('#calculator-content').locator('..');
    await expect.soft(calculator).toBeVisible();

    await calculator.screenshot({
      path: 'public/images/demo/screenshots/premium-analytics.png',
    });
  });

  test('capture tradesmen preview', async ({ page }) => {
    await openPropertyForScreenshot(page);
    await openCollapsible(page, 'Local Tradesmen & Services');

    const tradesmen = page.locator('section[aria-label="Local Tradesmen & Services"]');
    await expect(tradesmen).toContainText('Find qualified local tradespeople');
    await expect(tradesmen.getByRole('button', { name: /Contact/i }).first()).toBeVisible({ timeout: 15000 });

    await tradesmen.screenshot({
      path: 'public/images/demo/screenshots/premium-tradesmen.png',
    });
  });

  test('capture ai deal score preview', async ({ page }) => {
    await openPropertyForScreenshot(page);

    const aiScore = page.locator('section[aria-label="AI Deal Score"]');
    await expect(aiScore).toContainText('AI Deal Score');
    await expect(aiScore).toContainText('Version');
    await expect(aiScore).toContainText('73', { timeout: 5000 });

    await aiScore.screenshot({
      path: 'public/images/demo/screenshots/premium-ai-score.png',
    });

  });

  test('capture area intel preview', async ({ page }) => {
    await openPropertyForScreenshot(page);
    await openCollapsible(page, 'Area Insights');

    const areaInsights = page.locator('section[aria-label="Area Insights"]');
    await expect(areaInsights).toContainText('Avg price', { timeout: 15000 });
    await expect(areaInsights).toContainText('Schools');

    await areaInsights.screenshot({
      path: 'public/images/demo/screenshots/premium-area-intel.png',
    });
  });
});
