import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test('Upgrade CTA returns a Stripe URL', async ({ page, context }) => {
  // Intercept the backend call and stub a session URL in CI
  await context.route('**/stripe/checkout', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ url: 'https://checkout.stripe.com/pay/cs_test_123' }),
      headers: { 'content-type': 'application/json' },
    });
  });

  await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
  const btn = page.getByRole('button', { name: /upgrade/i });
  await expect(btn).toBeVisible();
  await btn.click();

  // Assert navigation intent is triggered
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
});
