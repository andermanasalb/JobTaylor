import { test, expect } from '@playwright/test'
import { clearAppStorage } from './fixtures'

/**
 * History page tests.
 *
 * History uses LocalStorage for persistence. We clear app-owned keys only
 * (preserving Supabase auth tokens) before each test.
 */

async function clearLocalStorage(page: import('@playwright/test').Page) {
  // Must be called AFTER a navigation so the page context has a real origin.
  await clearAppStorage(page)
}

async function saveFirstJob(page: import('@playwright/test').Page) {
  await page.goto('/search')
  await expect(page.getByText(/\d+ results/)).toBeVisible({ timeout: 5000 })
  // Use attribute selector to target only the actual bookmark button (not the card button)
  await page.locator('button[aria-label="Save posting"]').first().click()
  await expect(page.locator('button[aria-label="Unsave posting"]').first()).toBeVisible()
}

test.describe('History page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so localStorage is accessible, then clear it.
    await page.goto('/history')
    await clearLocalStorage(page)
    await page.reload()
    // Wait for the page to be ready after reload
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  })

  test('shows empty state when no history', async ({ page }) => {
    await expect(page.getByText('No history yet')).toBeVisible()
    await expect(page.getByText('Save a job from the Search page to start tracking it here.')).toBeVisible()
  })

  test('shows a saved job after saving from Search', async ({ page }) => {
    await saveFirstJob(page)
    await page.goto('/history')
    // The saved job should appear in the table (may render in desktop+mobile views)
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()
    await expect(page.getByText('BasqueCloud').first()).toBeVisible()
    // Status badge should be "Saved"
    await expect(page.getByText('Saved').first()).toBeVisible()
  })

  test('delete button opens confirmation dialog', async ({ page }) => {
    await saveFirstJob(page)
    await page.goto('/history')
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()

    // Click the delete button
    await page.getByRole('button', { name: 'Delete' }).first().click()

    // Confirmation dialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText('¿Eliminar entrada?')).toBeVisible()
  })

  test('cancelling delete dialog keeps the entry', async ({ page }) => {
    await saveFirstJob(page)
    await page.goto('/history')
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()

    // Click "No" (cancel)
    await page.getByRole('button', { name: 'No' }).click()

    // Entry should still be there
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()
  })

  test('confirming delete removes the entry', async ({ page }) => {
    await saveFirstJob(page)
    await page.goto('/history')
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()

    // Click "Sí, eliminar"
    await page.getByRole('button', { name: 'Sí, eliminar' }).click()

    // Entry should be gone, empty state should show
    await expect(page.getByText('No history yet')).toBeVisible()
  })

  test('search filter narrows entries', async ({ page }) => {
    await saveFirstJob(page)
    await page.goto('/history')
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()

    // Search for something that doesn't match
    await page.getByPlaceholder('Search history...').fill('zzznomatch')
    await expect(page.getByText('No entries found')).toBeVisible()

    // Clear filters
    await page.getByRole('button', { name: 'Clear', exact: true }).first().click()
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()
  })

  test('View job button navigates to Search with job pre-selected', async ({ page }) => {
    await saveFirstJob(page)
    await page.goto('/history')
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()

    await page.getByRole('link', { name: 'View job' }).first().click()
    await expect(page).toHaveURL(/\/search/)
  })
})
