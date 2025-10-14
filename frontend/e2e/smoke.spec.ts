// frontend/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test('home loads and navigation shell is visible-ish', async ({ page }) => {
  const res = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  // accept header OR nav OR a generic top bar
  const shell = page.locator('header, nav, [role="navigation"], [data-testid="site-header"]');
  await expect(shell.first()).toBeVisible({ timeout: 5000 });

  // relaxed title check
  await expect(page).toHaveTitle(/propnexus/i);
});

test('off-market page renders some heading or primary section', async ({ page }) => {
  const res = await page.goto(`${BASE}/off-market`, { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  // any visible heading (h1–h6) or a marked page title
  const head = page.locator('h1, h2, h3, [data-testid="page-title"]');
  await expect(head.first()).toBeVisible({ timeout: 5000 });

  // relaxed CTA existence
  const btn = page.getByRole('button').first();
  await expect(btn).toBeVisible();
});

test('saved deals page loads without loud console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const res = await page.goto(`${BASE}/saved-deals`, { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  // allow warnings; fail only on hard errors
  expect(errors.join('\n')).not.toMatch(/TypeError|ReferenceError|Unhandled/i);
});

test('property detail renders a title-ish element', async ({ page }) => {
  const res = await page.goto(`${BASE}/property/demo-id`, { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  // accept an h1, a data-testid, or any heading role
  const title = page.locator('h1, [data-testid="property-title"], :is(h1,h2,h3)[role="heading"]');
  await expect(title.first()).toBeVisible({ timeout: 5000 });
});
