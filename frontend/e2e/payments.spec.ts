// frontend/e2e/payments.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Payments smoke (secrets-free):
 * - Mocks POST /api/stripe/checkout to return a Stripe Checkout URL
 * - Visits /pricing
 * - Clicks a likely upgrade CTA (multiple fallbacks)
 * - Asserts we end up on checkout.stripe.com (host only)
 */
test('Upgrade button navigates to Stripe checkout', async ({ page }) => {
  await page.route('**/api/stripe/checkout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, url: 'https://checkout.stripe.com/test_session_123' }),
    });
  });

  // 👇 this is the line you asked about
  await page.goto('/pricing');

  // Try several CTA variants commonly used on pricing pages
  const candidates = [
    page.getByRole('button', { name: /upgrade/i }),
    page.getByRole('link', { name: /upgrade/i }),
    page.getByRole('button', { name: /(get pro|go pro|start pro|pro plan)/i }),
    page.getByRole('link', { name: /(get pro|go pro|start pro|pro plan)/i }),
  ];

  let clicked = false;
  for (const c of candidates) {
    if (await c.isVisible().catch(() => false)) {
      await c.click().catch(() => {});
      clicked = true;
      break;
    }
  }
  expect(clicked).toBeTruthy();

  await expect(page).toHaveURL((url) => url.host === 'checkout.stripe.com');
});
