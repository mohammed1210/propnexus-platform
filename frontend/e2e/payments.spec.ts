import { test, expect } from '@playwright/test';

/**
 * Payments smoke:
 * - Navigates to /pricing
 * - Mocks POST /api/stripe/checkout to return a Stripe Checkout URL
 * - Clicks an "Upgrade" CTA (button/link/text fallback)
 * - Asserts navigation to checkout.stripe.com (host only; no query leakage)
 */
test('Upgrade button navigates to Stripe checkout', async ({ page }) => {
  await page.route('**/api/stripe/checkout', async (route) => {
    // Simulate backend success regardless of env secrets
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        url: 'https://checkout.stripe.com/test_session_123',
      }),
    });
  });

  await page.goto('/pricing');

  // Try common CTA patterns: button, link, or any text fallback
  const candidates = [
    page.getByRole('button', { name: /upgrade/i }),
    page.getByRole('link', { name: /upgrade/i }),
    page.getByText(/upgrade/i)
  ];

  let clicked = false;
  for (const c of candidates) {
    if (await c.count()) {
      await c.first().click();
      clicked = true;
      break;
    }
  }
  expect(clicked).toBeTruthy();

  // The client code should set window.location to the provided URL
  await expect(page).toHaveURL((url) => url.host === 'checkout.stripe.com');
});
