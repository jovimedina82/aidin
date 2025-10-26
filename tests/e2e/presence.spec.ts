/**
 * E2E Tests for Presence Module
 *
 * Run with: npx playwright test tests/e2e/presence.spec.ts
 *
 * Scenarios:
 * 1. Create multi-segment schedule and verify it displays
 * 2. Overlap rejection
 * 3. Admin disables status and verifies it's removed from options
 */

import { test, expect } from '@playwright/test'

// Test data
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_USER_EMAIL = process.env.TEST_EMAIL || 'test@example.com'
const TEST_USER_PASSWORD = process.env.TEST_PASSWORD || 'password123'

test.describe('Presence Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="email"]', TEST_USER_EMAIL)
    await page.fill('input[name="password"]', TEST_USER_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for redirect
    await page.waitForURL('**/')
  })

  test('should create multi-segment schedule and display it', async ({ page }) => {
    // Navigate to schedule page
    await page.goto(`${BASE_URL}/my-schedule`) // Adjust URL as needed

    // Open planner modal
    await page.click('button:has-text("Plan Schedule")')

    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Select today's date (already selected by default)
    // Add first segment: 09:00-11:00 Working Remote
    await page.locator('input[type="time"]').first().fill('09:00')
    await page.locator('input[type="time"]').nth(1).fill('11:00')
    await page.click('select') // Status dropdown
    await page.click('text=Working Remote')

    // Add second segment
    await page.click('button:has-text("Add Segment")')

    // Fill second segment: 11:00-17:00 Available @ Newport Beach
    await page.locator('input[type="time"]').nth(2).fill('11:00')
    await page.locator('input[type="time"]').nth(3).fill('17:00')
    // Select Available status
    await page.locator('select').nth(1).click()
    await page.click('text=Available')
    // Select Newport Beach office
    await page.locator('select').nth(2).click()
    await page.click('text=Newport Beach')

    // Check duration indicator shows 8h
    await expect(page.locator('text=/8h.*of.*8h/')).toBeVisible()

    // Save
    await page.click('button:has-text("Save Schedule")')

    // Wait for success
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()

    // Verify segments are displayed
    await expect(page.locator('text=09:00 – 11:00')).toBeVisible()
    await expect(page.locator('text=Working Remote')).toBeVisible()
    await expect(page.locator('text=11:00 – 17:00')).toBeVisible()
    await expect(page.locator('text=Available')).toBeVisible()
    await expect(page.locator('text=Newport Beach')).toBeVisible()
  })

  test('should reject overlapping segments', async ({ page }) => {
    // Navigate to schedule page
    await page.goto(`${BASE_URL}/my-schedule`)

    // Open planner modal
    await page.click('button:has-text("Plan Schedule")')

    // Add first segment: 09:00-14:00
    await page.locator('input[type="time"]').first().fill('09:00')
    await page.locator('input[type="time"]').nth(1).fill('14:00')
    await page.click('select')
    await page.click('text=Working Remote')

    // Add second segment: 12:00-17:00 (overlaps with first)
    await page.click('button:has-text("Add Segment")')
    await page.locator('input[type="time"]').nth(2).fill('12:00')
    await page.locator('input[type="time"]').nth(3).fill('17:00')
    await page.locator('select').nth(1).click()
    await page.click('text=Available')
    await page.locator('select').nth(2).click()
    await page.click('text=Newport Beach')

    // Try to save
    await page.click('button:has-text("Save Schedule")')

    // Should show error about overlap
    await expect(page.locator('text=/Overlaps/')).toBeVisible()

    // Modal should still be open
    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })

  test('should reject schedule exceeding 8h daily cap', async ({ page }) => {
    // Navigate to schedule page
    await page.goto(`${BASE_URL}/my-schedule`)

    // Open planner modal
    await page.click('button:has-text("Plan Schedule")')

    // Add segment: 09:00-18:00 (9 hours)
    await page.locator('input[type="time"]').first().fill('09:00')
    await page.locator('input[type="time"]').nth(1).fill('18:00')
    await page.click('select')
    await page.click('text=Working Remote')

    // Check duration indicator shows error
    await expect(page.locator('text=/Exceeds daily limit/')).toBeVisible()
    await expect(page.locator('text=/9.*h.*of.*8h/')).toBeVisible()

    // Try to save
    await page.click('button:has-text("Save Schedule")')

    // Should show error about exceeding cap
    await expect(page.locator('text=/exceeds daily cap/')).toBeVisible()
  })

  test('should delete individual segment', async ({ page }) => {
    // First create a schedule with 2 segments
    await page.goto(`${BASE_URL}/my-schedule`)
    await page.click('button:has-text("Plan Schedule")')

    // Segment 1: 09:00-12:00
    await page.locator('input[type="time"]').first().fill('09:00')
    await page.locator('input[type="time"]').nth(1).fill('12:00')
    await page.click('select')
    await page.click('text=Working Remote')

    // Segment 2: 13:00-17:00
    await page.click('button:has-text("Add Segment")')
    await page.locator('input[type="time"]').nth(2).fill('13:00')
    await page.locator('input[type="time"]').nth(3).fill('17:00')
    await page.locator('select').nth(1).click()
    await page.click('text=Working Remote')

    await page.click('button:has-text("Save Schedule")')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()

    // Verify both segments are visible
    await expect(page.locator('text=09:00 – 12:00')).toBeVisible()
    await expect(page.locator('text=13:00 – 17:00')).toBeVisible()

    // Delete first segment
    await page.locator('button[aria-label="Delete segment"]').first().click()
    await page.click('button:has-text("OK")') // Confirm dialog

    // Verify first segment is gone
    await expect(page.locator('text=09:00 – 12:00')).not.toBeVisible()

    // Verify second segment still exists
    await expect(page.locator('text=13:00 – 17:00')).toBeVisible()
  })

  test.describe('Admin Features', () => {
    test.use({ storageState: 'tests/e2e/fixtures/admin.json' }) // Admin auth state

    test('should disable status and remove from planner options', async ({ page }) => {
      // Navigate to admin status management
      await page.goto(`${BASE_URL}/admin/presence/statuses`)

      // Find VACATION status and disable it
      await page.locator('tr:has-text("Vacation")').locator('button:has-text("Edit")').click()

      // Toggle isActive to false
      await page.click('input[name="isActive"]')

      // Save
      await page.click('button:has-text("Save")')

      // Wait for success
      await expect(page.locator('text=/Status updated/')).toBeVisible()

      // Now go to planner and verify VACATION is not in options
      await page.goto(`${BASE_URL}/my-schedule`)
      await page.click('button:has-text("Plan Schedule")')

      // Open status dropdown
      await page.click('select')

      // VACATION should not be in the list
      await expect(page.locator('option:has-text("Vacation")')).not.toBeVisible()

      // But AVAILABLE should still be there
      await expect(page.locator('option:has-text("Available")')).toBeVisible()

      // Re-enable VACATION for other tests
      await page.goto(`${BASE_URL}/admin/presence/statuses`)
      await page.locator('tr:has-text("Vacation")').locator('button:has-text("Edit")').click()
      await page.click('input[name="isActive"]')
      await page.click('button:has-text("Save")')
    })
  })

  test('should show read-only view for requester role', async ({ page }) => {
    test.use({ storageState: 'tests/e2e/fixtures/requester.json' }) // Requester auth state

    // Navigate to staff directory
    await page.goto(`${BASE_URL}/staff-directory`)

    // Select a staff member with scheduled presence
    await page.click('text=John Doe') // Adjust as needed

    // Should see presence schedule
    await expect(page.locator('text=/09:00.*17:00/')).toBeVisible()

    // Should NOT see "Plan Schedule" button
    await expect(page.locator('button:has-text("Plan Schedule")')).not.toBeVisible()

    // Should NOT see delete buttons
    await expect(page.locator('button[aria-label="Delete segment"]')).not.toBeVisible()
  })

  test('should create repeating schedule for 7 days', async ({ page }) => {
    await page.goto(`${BASE_URL}/my-schedule`)
    await page.click('button:has-text("Plan Schedule")')

    // Select today
    const today = new Date()
    const todayStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Set repeat until (7 days from today)
    const repeatUntil = new Date(today)
    repeatUntil.setDate(repeatUntil.getDate() + 7)
    const repeatStr = repeatUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    await page.click('button:has-text("No repeat")')
    await page.click(`text=${repeatStr}`)

    // Add segment
    await page.locator('input[type="time"]').first().fill('09:00')
    await page.locator('input[type="time"]').nth(1).fill('17:00')
    await page.click('select')
    await page.click('text=Working Remote')

    // Save
    await page.click('button:has-text("Save Schedule")')

    // Should show success with "8 days affected"
    await expect(page.locator('text=/8 days affected/')).toBeVisible()

    // Navigate through dates and verify schedule exists for each day
    for (let i = 0; i < 8; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() + i)
      const checkDateStr = checkDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

      await page.click(`text=${checkDateStr}`)
      await expect(page.locator('text=09:00 – 17:00')).toBeVisible()
      await expect(page.locator('text=Working Remote')).toBeVisible()
    }
  })
})
