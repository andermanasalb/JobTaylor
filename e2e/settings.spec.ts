import { test, expect } from '@playwright/test'
import { clearAppStorage } from './fixtures'

/**
 * Settings page tests — export format, template, language, strictness, photo.
 * Settings are persisted in localStorage under 'jobtaylor-settings'.
 */

async function clearLocalStorage(page: import('@playwright/test').Page) {
  // Must be called AFTER a navigation so the page context has a real origin.
  await clearAppStorage(page)
}

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so localStorage is accessible, then clear it.
    await page.goto('/settings')
    await clearLocalStorage(page)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('shows all settings sections', async ({ page }) => {
    await expect(page.getByText('Output Language')).toBeVisible()
    await expect(page.getByText('CV Template')).toBeVisible()
    await expect(page.getByText('Tailoring Strictness')).toBeVisible()
    await expect(page.getByText('Export Defaults')).toBeVisible()
    await expect(page.getByText('Profile Photo')).toBeVisible()
  })

  test('can select classic template', async ({ page }) => {
    await page.getByRole('button', { name: 'classic' }).click()
    // After selection, the page should remain stable (no crash)
    await expect(page.getByText('CV Template')).toBeVisible()
  })

  test('can select minimal template', async ({ page }) => {
    await page.getByRole('button', { name: 'minimal' }).click()
    await expect(page.getByText('CV Template')).toBeVisible()
  })
})
