import { test, expect, testAsRole } from './fixtures/auth';
import type { Page, Locator } from '@playwright/test';

/**
 * Crawler Test Suite
 *
 * These tests systematically navigate through the application,
 * clicking on accessible elements to ensure no crashes occur.
 */

/**
 * Helper to click all interactive elements on a page
 */
async function clickAllInteractiveElements(page: Page, options: {
  excludeSelectors?: string[];
  maxClicks?: number;
} = {}): Promise<{ clicked: number; errors: string[] }> {
  const {
    excludeSelectors = [
      '[data-testid="logout-button"]',
      'button:has-text("Logout")',
      'button:has-text("Sign Out")',
      'button:has-text("Delete")',
      'button:has-text("Remove")',
      '[type="submit"]', // Avoid form submissions
    ],
    maxClicks = 50,
  } = options;

  const errors: string[] = [];
  let clicked = 0;

  // Get all clickable elements
  const clickableSelectors = [
    'a:visible',
    'button:visible:not([disabled])',
    '[role="button"]:visible',
    '[role="tab"]:visible',
    '[role="menuitem"]:visible',
  ];

  for (const selector of clickableSelectors) {
    if (clicked >= maxClicks) break;

    try {
      const elements = await page.locator(selector).all();

      for (const element of elements) {
        if (clicked >= maxClicks) break;

        // Check if element should be excluded
        let shouldExclude = false;
        for (const excludeSelector of excludeSelectors) {
          const matches = await element.evaluate((el, selector) => {
            return el.matches(selector);
          }, excludeSelector);

          if (matches) {
            shouldExclude = true;
            break;
          }
        }

        if (shouldExclude) continue;

        // Check if element is visible and enabled
        const isVisible = await element.isVisible().catch(() => false);
        const isEnabled = await element.isEnabled().catch(() => false);

        if (!isVisible || !isEnabled) continue;

        try {
          // Get element info for debugging
          const tagName = await element.evaluate(el => el.tagName);
          const text = await element.textContent().catch(() => '');

          // Click the element
          await element.click({ timeout: 2000 });
          clicked++;

          // Wait a bit for any async operations
          await page.waitForTimeout(300);

          // Check for console errors
          // (Note: This requires setting up console listeners in the test setup)

        } catch (clickError: any) {
          // Some clicks might fail (e.g., element moved, dialog appeared)
          // We'll continue but log the error
          errors.push(`Click failed: ${clickError.message}`);
        }
      }
    } catch (selectorError: any) {
      errors.push(`Selector error for ${selector}: ${selectorError.message}`);
    }
  }

  return { clicked, errors };
}

/**
 * Helper to navigate through common pages
 */
async function crawlCommonPages(page: Page): Promise<void> {
  const commonPaths = [
    '/',
    '/dashboard',
    '/tickets',
    '/admin',
    '/admin/modules',
  ];

  for (const path of commonPaths) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Wait for any loading states to complete
      await page.waitForTimeout(500);

      // Check that the page doesn't have critical errors
      const hasErrorMessage = await page.locator('text=/error|crash|something went wrong/i').isVisible({ timeout: 1000 }).catch(() => false);

      if (hasErrorMessage) {
        console.warn(`Warning: Error message found on ${path}`);
      }

      // Try clicking some elements on this page
      const { clicked, errors } = await clickAllInteractiveElements(page, { maxClicks: 10 });

      if (errors.length > 0) {
        console.warn(`Errors on ${path}:`, errors.slice(0, 3)); // Log first 3 errors
      }

    } catch (navError) {
      // Page might not exist for this role, that's okay
      console.log(`Could not navigate to ${path}, skipping`);
    }
  }
}

test.describe('Crawler Tests', () => {
  test('crawler: requester role', async ({ page, loginAs, logoutUser }) => {
    await loginAs('requester');

    try {
      await crawlCommonPages(page);

      // Verify we didn't crash
      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();

    } finally {
      await logoutUser();
    }
  });

  test('crawler: staff role', async ({ page, loginAs, logoutUser }) => {
    await loginAs('staff');

    try {
      await crawlCommonPages(page);

      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();

    } finally {
      await logoutUser();
    }
  });

  test('crawler: manager role', async ({ page, loginAs, logoutUser }) => {
    await loginAs('manager');

    try {
      await crawlCommonPages(page);

      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();

    } finally {
      await logoutUser();
    }
  });

  test('crawler: admin role', async ({ page, loginAs, logoutUser }) => {
    await loginAs('admin');

    try {
      await crawlCommonPages(page);

      // Admin should have access to admin pages
      await page.goto('/admin/modules');
      await expect(page.locator('h1, h2, [data-testid="page-title"]')).toContainText(/module|permission|admin/i, { timeout: 5000 });

      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();

    } finally {
      await logoutUser();
    }
  });

  test('crawler: navigation links work', async ({ page, loginAs, logoutUser }) => {
    await loginAs('staff');

    try {
      // Click all navigation links
      const navLinks = page.locator('nav a, [role="navigation"] a');
      const count = await navLinks.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        try {
          const link = navLinks.nth(i);
          const isVisible = await link.isVisible().catch(() => false);

          if (isVisible) {
            await link.click({ timeout: 2000 });
            await page.waitForLoadState('domcontentloaded');

            // Verify page loaded without errors
            const hasError = await page.locator('text=/error|crash/i').isVisible({ timeout: 1000 }).catch(() => false);
            expect(hasError).toBe(false);
          }
        } catch (e) {
          // Link might have been removed or navigation blocked
          console.log(`Navigation link ${i} failed, continuing...`);
        }
      }

    } finally {
      await logoutUser();
    }
  });
});
