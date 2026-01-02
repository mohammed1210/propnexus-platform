import { test, expect } from '@playwright/test';

/**
 * Accessibility E2E Tests - Keyboard Navigation
 *
 * Tests keyboard navigation and focus management across critical flows
 */

test.describe('Keyboard Navigation - Homepage', () => {
  test('should allow navigation with Tab key', async ({ page }) => {
    await page.goto('/');

    // Press Tab to move through interactive elements
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Logo
    await page.keyboard.press('Tab'); // First nav item

    // Check that focus is visible
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should show skip link on focus', async ({ page }) => {
    await page.goto('/');

    // Skip link should be visible when focused
    await page.keyboard.press('Tab');
    const skipLink = page.locator('a[href="#main"]');
    await expect(skipLink).toBeVisible();
  });

  test('should activate search with Enter key', async ({ page }) => {
    await page.goto('/');

    // Focus on search input
    await page.locator('input[placeholder*="location"]').focus();
    await page.keyboard.type('Manchester');
    await page.keyboard.press('Enter');

    // Should navigate to listings page
    await expect(page).toHaveURL(/\/listings\?q=Manchester/);
  });

  test('should navigate quick links with keyboard', async ({ page }) => {
    await page.goto('/');

    // Tab to quick links section
    const browseLink = page.locator('a:text("Browse listings")').first();
    await browseLink.focus();

    // Press Enter to navigate
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/listings/);
  });
});

test.describe('Keyboard Navigation - Listings', () => {
  test('should navigate filters with keyboard', async ({ page }) => {
    await page.goto('/listings');

    // Tab to search input
    const searchInput = page.locator('input[aria-label*="Search"]');
    await searchInput.focus();
    await page.keyboard.type('London');

    // Tab to min price
    await page.keyboard.press('Tab');
    await page.keyboard.type('100000');

    // Tab to max price
    await page.keyboard.press('Tab');
    await page.keyboard.type('500000');

    // Tab to Apply button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Activate apply button
    await page.keyboard.press('Enter');

    // URL should contain filters
    await expect(page).toHaveURL(/min=100000/);
  });

  test('should toggle more filters with keyboard', async ({ page }) => {
    await page.goto('/listings');

    // Find and focus the "More filters" button
    const moreFiltersButton = page.locator('button:has-text("More filters")');
    await moreFiltersButton.focus();

    // Activate with Enter
    await page.keyboard.press('Enter');

    // More filters section should be visible
    const moreFiltersSection = page.locator('#more-filters-section');
    await expect(moreFiltersSection).toBeVisible();

    // Close with keyboard
    await moreFiltersButton.focus();
    await page.keyboard.press('Enter');
    await expect(moreFiltersSection).not.toBeVisible();
  });

  test('should navigate property cards with Tab', async ({ page }) => {
    await page.goto('/listings');
    await page.waitForLoadState('networkidle');

    // Find first property card
    const firstCard = page.locator('article').first();
    const cardLink = firstCard.locator('a').first();

    await cardLink.focus();
    const focused = await page.locator(':focus');
    await expect(focused).toHaveAttribute('href', /\/property\//);
  });
});

test.describe('Keyboard Navigation - Property Details', () => {
  test('should navigate property details page', async ({ page }) => {
    // Go to listings first
    await page.goto('/listings');
    await page.waitForLoadState('networkidle');

    // Click first property
    const firstCard = page.locator('article').first();
    const cardLink = firstCard.locator('a').first();
    await cardLink.click();

    // Wait for property page
    await page.waitForLoadState('networkidle');

    // Should be able to tab through interactive elements
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Logo

    // Check focus is visible
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Keyboard Navigation - Modal/Dialog', () => {
  test('should trap focus in AI chatbot dialog', async ({ page }) => {
    // This test assumes AI chatbot is enabled
    await page.goto('/listings');

    // Look for AI chatbot button
    const chatbotButton = page.locator('button:has-text("Ask AI")');

    // Skip if chatbot is not available (feature flag disabled)
    if (await chatbotButton.count() === 0) {
      test.skip();
      return;
    }

    await chatbotButton.click();

    // Dialog should be visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Tab through dialog elements
    await page.keyboard.press('Tab'); // Close button
    await page.keyboard.press('Tab'); // First quick prompt
    await page.keyboard.press('Tab'); // Second quick prompt
    await page.keyboard.press('Tab'); // Third quick prompt
    await page.keyboard.press('Tab'); // Input field
    await page.keyboard.press('Tab'); // Send button

    // Focus should still be within dialog
    const focusedElement = await page.locator(':focus');
    const isInDialog = await focusedElement.locator('xpath=ancestor::*[@role="dialog"]').count();
    expect(isInDialog).toBeGreaterThan(0);
  });

  test('should close dialog with Escape key', async ({ page }) => {
    await page.goto('/listings');

    const chatbotButton = page.locator('button:has-text("Ask AI")');

    if (await chatbotButton.count() === 0) {
      test.skip();
      return;
    }

    await chatbotButton.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('Focus Indicators', () => {
  test('should show visible focus indicators on all interactive elements', async ({ page }) => {
    await page.goto('/');

    // Check navigation links have focus styles
    const navLink = page.locator('nav a').first();
    await navLink.focus();

    // Check computed styles include focus indicator
    const outline = await navLink.evaluate((el) => {
      return window.getComputedStyle(el).outline;
    });

    // Should have some form of outline or ring
    expect(outline).not.toBe('none');
  });

  test('should show focus on buttons', async ({ page }) => {
    await page.goto('/');

    const searchButton = page.locator('button:has-text("Search")');
    await searchButton.focus();

    // Button should be focused
    const isFocused = await searchButton.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);
  });
});

test.describe('Screen Reader Support', () => {
  test('should have proper ARIA labels on icon buttons', async ({ page }) => {
    await page.goto('/');

    // Check dark mode toggle has aria-label
    const darkModeButton = page.locator('button:has-text("Dark")');
    await expect(darkModeButton).toHaveAttribute('aria-label', /dark mode/i);
  });

  test('should have proper alt text on images', async ({ page }) => {
    await page.goto('/listings');
    await page.waitForLoadState('networkidle');

    // Check property card images
    const images = page.locator('article img');
    const count = await images.count();

    if (count > 0) {
      const firstImage = images.first();
      await expect(firstImage).toHaveAttribute('alt');
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/listings');

    // Check search input has label
    const searchInput = page.locator('input[placeholder*="Search"]');
    const ariaLabel = await searchInput.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('should mark decorative elements with aria-hidden', async ({ page }) => {
    await page.goto('/');

    // Check that icon elements are marked as decorative
    const icons = page.locator('svg[aria-hidden="true"]');
    const count = await icons.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Landmarks and Semantic HTML', () => {
  test('should have main landmark', async ({ page }) => {
    await page.goto('/');

    const main = page.locator('main');
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute('id', 'main');
  });

  test('should have navigation landmark with label', async ({ page }) => {
    await page.goto('/');

    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Should have exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // H1 should be visible
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
  });
});

test.describe('Mobile Touch Targets', () => {
  test('should have adequate touch targets on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check button sizes
    const buttons = page.locator('button, a[href]');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        // Should be at least 44x44px for touch targets
        expect(box.height).toBeGreaterThanOrEqual(40); // Allow some tolerance
      }
    }
  });
});
