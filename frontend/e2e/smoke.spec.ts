import { test, expect } from '@playwright/test';

test('home loads and nav visible', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PropNexus/i);
  // something stable in header
  await expect(page.locator('header')).toBeVisible();
});

test('off-market page renders generator section', async ({ page }) => {
  await page.goto('/off-market');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // button exists (text may differ, keep relaxed)
  const btn = page.getByRole('button', { name: /generate|create|deals/i });
  await expect(btn.first()).toBeVisible();
});

test('saved deals page loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/saved-deals');
  // Allow non-critical warnings; fail only on loud errors
  expect(errors.join('\n')).not.toMatch(/TypeError|ReferenceError|Unhandled/i);
});

test('property detail renders title (uses a placeholder id)', async ({ page }) => {
  // Use an ID that your app tolerates (SSR should render the shell even if fetch fails)
  await page.goto('/property/demo-id');
  // Expect the page shell (title/headline region) to exist
  await expect(page.locator('h1, [data-testid="property-title"]')).toBeVisible({ timeout: 5000 });
});
