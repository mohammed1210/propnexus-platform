import { test, expect } from '@playwright/test';

/**
 * Verifies that clicking "Upgrade" on /pricing navigates to Stripe Checkout.
 */
test('Upgrade button navigates to Stripe checkout', async ({ page }) => {
  await page.goto('/pricing');
  await page.getByRole('button', { name: /upgrade/i }).click();
  await expect(page).toHaveURL((url) => url.href.includes('checkout.stripe.com'));
});
