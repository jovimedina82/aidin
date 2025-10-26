import { test, expect } from './fixtures/auth';

/**
 * Basic smoke tests - verify the application loads
 */
test.describe('Smoke Tests', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/AidIN|Login|Helpdesk/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('can login as requester', async ({ page, loginAs }) => {
    await loginAs('requester');
    // Should be redirected to a page that's not login
    await expect(page).not.toHaveURL('/login');
  });

  test('can login as staff', async ({ page, loginAs }) => {
    await loginAs('staff');
    await expect(page).not.toHaveURL('/login');
  });

  test('can login as manager', async ({ page, loginAs }) => {
    await loginAs('manager');
    await expect(page).not.toHaveURL('/login');
  });

  test('can login as admin', async ({ page, loginAs }) => {
    await loginAs('admin');
    await expect(page).not.toHaveURL('/login');
  });

  test('can logout', async ({ page, loginAs, logoutUser }) => {
    await loginAs('staff');
    await logoutUser();
    await expect(page).toHaveURL('/login');
  });
});
