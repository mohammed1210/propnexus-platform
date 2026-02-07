// frontend/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

// NOTE: baseURL is configured in playwright.config.ts; use relative paths.

test('home loads and body is visible', async ({ page }) => {
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  await expect(page.locator('body')).toBeVisible({ timeout: 5000 });

  // relaxed title match (case-insensitive, doesn’t break on wording tweaks)
  await expect(page).toHaveTitle(/propnexus/i);
});

test('off-market page renders a heading-ish element', async ({ page }) => {
  const res = await page.goto('/off-market', { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  const head = page.locator('h1, h2, h3, [data-testid="page-title"], [role="heading"]');
  await expect(head.first()).toBeVisible({ timeout: 5000 });

  // relaxed CTA existence
  const btn = page.getByRole('button').first();
  await expect(btn).toBeVisible();
});

test('saved deals pages load without hard console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const res1 = await page.goto('/saved', { waitUntil: 'domcontentloaded' });
  expect(res1?.ok()).toBeTruthy();

  const res2 = await page.goto('/saved-deals', { waitUntil: 'domcontentloaded' });
  expect(res2?.ok()).toBeTruthy();

  // allow warnings; fail on common hard errors only
  expect(errors.join('\n')).not.toMatch(/TypeError|ReferenceError|Unhandled/i);
});

test('property detail renders page content', async ({ page }) => {
  const res = await page.goto('/property/demo-id', { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
});
