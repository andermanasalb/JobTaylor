import { test, expect } from '@playwright/test'
import { clearAppStorage } from './fixtures'

/**
 * Navigation tests — verify all sidebar links route to the correct pages.
 * These use desktop viewport (default) so the sidebar is always visible.
 */

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Clear only app-owned keys; preserve Supabase auth tokens
    await clearAppStorage(page)
    // Wait for the app to settle past the loading skeleton
    await page.waitForURL(/\/search/)
  })

  test('navigates to Search page', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Search' }).click()
    await expect(page).toHaveURL(/\/search/)
    // Results or loading indicator is visible
    await expect(page.getByPlaceholder('Search by role, title, or keyword...')).toBeVisible()
  })

  test('navigates to CV Base page', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'CV Base' }).click()
    await expect(page).toHaveURL(/\/cv/)
    await expect(page.getByPlaceholder('Full name')).toBeVisible()
  })

  test('navigates to History page', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/history/)
    await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible()
  })

  test('navigates to Settings page', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('active link has aria-current="page"', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/\/history/)
    const historyLink = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'History' })
    await expect(historyLink).toHaveAttribute('aria-current', 'page')
  })

  test('theme toggle changes mode label', async ({ page }) => {
    const themeBtn = page.getByRole('button', { name: /Switch to (light|dark) mode/ })
    await expect(themeBtn).toBeVisible()
    const initialLabel = await themeBtn.getAttribute('aria-label')
    await themeBtn.click()
    // After clicking, the label should flip
    const newLabel = await themeBtn.getAttribute('aria-label')
    expect(newLabel).not.toEqual(initialLabel)
  })
})
