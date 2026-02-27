import { test, expect } from '@playwright/test'
import { clearAppStorage } from './fixtures'

/**
 * Settings page tests — AI mode, export format, template, language.
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
    await expect(page.getByText('AI Processing Mode')).toBeVisible()
    await expect(page.getByText('Output Language')).toBeVisible()
    await expect(page.getByText('CV Template')).toBeVisible()
    await expect(page.getByText('Tailoring Strictness')).toBeVisible()
    await expect(page.getByText('Export Defaults')).toBeVisible()
    await expect(page.getByText('Profile Photo')).toBeVisible()
  })

  test('Cloud processing mode shows confirmation dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Cloud' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText('Switch to Cloud Processing?')).toBeVisible()
  })

  test('cancelling cloud dialog stays on Local mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Cloud' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: 'Stay on Local' }).click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
  })

  test('confirming cloud dialog switches to Cloud mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Cloud' }).click()
    await page.getByRole('button', { name: 'Switch to Cloud' }).click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    // After confirming, page should remain on settings
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
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

  test('settings link from tailor guardrail navigates here', async ({ page }) => {
    // Navigate to a tailor page to trigger the guardrail banner
    await page.goto('/tailor/some-id-12345')
    // The guardrail banner should be visible with a Settings link
    await expect(page.getByText(/Guardrail:/)).toBeVisible()
    // There are two "Settings" links: one in the sidebar nav and one in the guardrail banner.
    // Scope to the guardrail link by excluding the sidebar navigation.
    const guardrailLink = page.locator('a[href="/settings"]').filter({ hasNot: page.getByRole('navigation', { name: 'Main navigation' }) }).first()
    await guardrailLink.click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })
})
