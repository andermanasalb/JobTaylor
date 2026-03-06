import { test, expect } from '@playwright/test'
import { clearAppStorage, clearSupabaseHistory, setupAdzunaMock, setupProxyMock } from './fixtures'

/**
 * History page tests.
 *
 * History uses Supabase for persistence. We clear both app-owned localStorage
 * keys AND Supabase history_entries before each test so tests are isolated.
 */

/** Saves the first job card visible on the Search page, then waits for
 *  Supabase to persist the entry before returning. */
async function saveFirstJob(page: import('@playwright/test').Page) {
  // Set up mocks before navigating so all network calls are intercepted.
  await setupAdzunaMock(page)
  await setupProxyMock(page)
  await page.goto('/search')
  // Clear stale app state (localStorage + sessionStorage) so SearchPage starts fresh.
  await clearAppStorage(page)

  // Register listener BEFORE reload so it catches the listHistoryEntries GET that
  // SearchPage fires on mount. We must wait for it to resolve before clicking Save,
  // otherwise the late-resolving Supabase response will overwrite the optimistic
  // savedJobs state and flip the aria-label back to "Save posting".
  const listHistoryDone = page.waitForResponse(
    resp =>
      resp.url().includes('/rest/v1/history_entries') &&
      resp.request().method() === 'GET',
    { timeout: 10000 },
  )

  await page.reload()
  await expect(page.getByText(/\d+ results/)).toBeVisible({ timeout: 8000 })
  // Ensure listHistoryEntries has fully resolved before clicking Save
  await listHistoryDone

  // Register listener BEFORE clicking so we can wait for the upsert POST that
  // addHistoryEntry fires. Waiting for it ensures the row exists in Supabase
  // before we navigate to /history.
  const saveHistoryDone = page.waitForResponse(
    resp =>
      resp.url().includes('/rest/v1/history_entries') &&
      resp.request().method() === 'POST',
    { timeout: 10000 },
  )

  // Click the bookmark button on the first job card
  await page.locator('button[aria-label="Save posting"]').first().click()
  // Wait for the optimistic UI update (aria-label flips immediately in handleSave)
  await expect(page.locator('button[aria-label="Unsave posting"]').first()).toBeVisible({ timeout: 8000 })
  // Wait for the Supabase upsert to complete before navigating away
  await saveHistoryDone
}

/** Navigate to /history and wait until the list or empty state is visible. */
async function gotoHistory(page: import('@playwright/test').Page) {
  await page.goto('/history')
  // Wait for the loading spinner text to disappear
  await expect(page.getByText('Loading…')).not.toBeVisible({ timeout: 8000 })
}

test.describe.serial('History page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so localStorage and Supabase session are accessible.
    await page.goto('/history')
    // Clear app localStorage keys (restores English + activity timestamp).
    await clearAppStorage(page)
    // Clear Supabase history_entries so each test starts with a clean slate.
    await clearSupabaseHistory(page)
    await page.reload()
    // Wait for the heading to be visible (page loaded)
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible({ timeout: 8000 })
    // Wait for data to load and empty state to appear
    await expect(page.getByText('No history yet')).toBeVisible({ timeout: 8000 })
  })

  test('shows empty state when no history', async ({ page }) => {
    await expect(page.getByText('No history yet')).toBeVisible()
    await expect(page.getByText('Save a job from the Search page to start tracking it here.')).toBeVisible()
  })

  test('shows a saved job after saving from Search', async ({ page }) => {
    await saveFirstJob(page)
    await gotoHistory(page)
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('BasqueCloud').first()).toBeVisible()
    // Status badge should be "Saved"
    await expect(page.getByText('Saved').first()).toBeVisible()
  })

  test('delete button opens confirmation dialog', async ({ page }) => {
    await saveFirstJob(page)
    await gotoHistory(page)
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible({ timeout: 8000 })

    // Click the delete button
    await page.getByRole('button', { name: 'Delete' }).first().click()

    // Confirmation dialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText('Delete entry?')).toBeVisible()
  })

  test('cancelling delete dialog keeps the entry', async ({ page }) => {
    await saveFirstJob(page)
    await gotoHistory(page)
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()

    // Click "No" (cancel)
    await page.getByRole('button', { name: 'No' }).click()

    // Entry should still be there
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()
  })

  test('confirming delete removes the entry', async ({ page }) => {
    await saveFirstJob(page)
    await gotoHistory(page)
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()

    // Click "Yes, delete"
    await page.getByRole('button', { name: 'Yes, delete' }).click()

    // Entry should be gone, empty state should show
    await expect(page.getByText('No history yet')).toBeVisible()
  })

  test('clicking job title navigates to Search', async ({ page }) => {
    await saveFirstJob(page)
    await gotoHistory(page)
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible({ timeout: 8000 })

    // The job title is a button that navigates to /search with state
    await page.getByRole('button', { name: 'Senior Software Engineer' }).first().click()
    await expect(page).toHaveURL(/\/search/)
  })
})
