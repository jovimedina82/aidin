import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export type Role = 'requester' | 'staff' | 'manager' | 'admin';

/**
 * Test credentials for each role
 * NOTE: These should be test accounts only, never use production credentials
 */
const TEST_CREDENTIALS: Record<Role, { email: string; password: string }> = {
  requester: {
    email: process.env.TEST_REQUESTER_EMAIL || 'test-requester@example.com',
    password: process.env.TEST_REQUESTER_PASSWORD || 'test123',
  },
  staff: {
    email: process.env.TEST_STAFF_EMAIL || 'test-staff@example.com',
    password: process.env.TEST_STAFF_PASSWORD || 'test123',
  },
  manager: {
    email: process.env.TEST_MANAGER_EMAIL || 'test-manager@example.com',
    password: process.env.TEST_MANAGER_PASSWORD || 'test123',
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'test-admin@example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'test123',
  },
};

/**
 * Login helper function
 */
async function login(page: Page, role: Role): Promise<void> {
  const creds = TEST_CREDENTIALS[role];

  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be visible
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Fill in credentials
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete (dashboard or home page)
  await page.waitForURL(/\/(dashboard|tickets|home)/, { timeout: 15000 });

  // Verify login succeeded by checking for user menu or logout button
  const isLoggedIn = await page.locator('[data-testid="user-menu"], [data-testid="logout-button"], nav').isVisible({ timeout: 5000 }).catch(() => false);

  if (!isLoggedIn) {
    throw new Error(`Login failed for role: ${role}`);
  }
}

/**
 * Logout helper function
 */
async function logout(page: Page): Promise<void> {
  // Look for logout button or user menu
  const logoutButton = page.locator('[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign Out")');

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL('/login', { timeout: 5000 });
  }
}

/**
 * Extended test fixture that provides authenticated contexts for each role
 */
type AuthFixtures = {
  authenticatedPage: Page;
  loginAs: (role: Role) => Promise<void>;
  logoutUser: () => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // This is the same as 'page', but signals that it should be authenticated
    await use(page);
  },

  loginAs: async ({ page }, use) => {
    const loginFn = async (role: Role) => {
      await login(page, role);
    };
    await use(loginFn);
  },

  logoutUser: async ({ page }, use) => {
    const logoutFn = async () => {
      await logout(page);
    };
    await use(logoutFn);
  },
});

export { expect };

/**
 * Helper to create a test suite for a specific role
 */
export function testAsRole(role: Role, title: string, testFn: (page: Page) => Promise<void>) {
  test(title, async ({ page, loginAs, logoutUser }) => {
    await loginAs(role);
    try {
      await testFn(page);
    } finally {
      await logoutUser();
    }
  });
}
