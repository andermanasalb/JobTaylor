import { test, expect } from '@playwright/test'
import { clearAppStorage, clearSupabaseHistory, setupAdzunaMock, setupProxyMock } from './fixtures'

/**
 * Tailoring flow tests.
 *
 * The SearchPage's inline generate flow generates CVs in a detail panel
 * without navigating away from the search page.
 *
 * Tests cover:
 * 1. Inline generate flow (SearchPage → Generate CV)
 * 2. Creating a job via editor → saved → navigate to /search
 *
 * Adzuna API calls are intercepted so tests are deterministic.
 */

async function clearLocalStorage(page: import('@playwright/test').Page) {
  // Must be called AFTER a navigation so the page context has a real origin.
  await clearAppStorage(page)
}

/**
 * Creates a base CV with minimum required fields so the generate flow works.
 * With LocalStorageCvRepository, the form auto-saves on unmount when navigating away.
 */
async function createBaseCv(page: import('@playwright/test').Page) {
  await page.goto('/cv')
  await expect(page.getByPlaceholder('Full name')).toBeVisible()
  await page.getByPlaceholder('Full name').fill('Test User')
  await page.getByPlaceholder('email@example.com').fill('test@example.com')
  // Wait for the 800ms auto-save debounce to fire, ensuring the CV is persisted
  // before navigating away (the unmount save also fires, but this is belt-and-suspenders)
  await page.waitForTimeout(1000)
}

test.describe('Inline tailoring (SearchPage)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Adzuna API and local proxy before navigating.
    await setupAdzunaMock(page)
    await setupProxyMock(page)
    // Navigate first so localStorage is accessible, then clear app keys only.
    await page.goto('/search')
    await clearAppStorage(page)
    // Clear Supabase history for a clean slate, then wait for SearchPage's
    // listHistoryEntries GET to fully resolve before the test body runs.
    // This prevents the race condition where a late-resolving GET overwrites
    // optimistic UI state (e.g. the save/generate button state).
    await clearSupabaseHistory(page)
    const listHistoryDone = page.waitForResponse(
      resp =>
        resp.url().includes('/rest/v1/history_entries') &&
        resp.request().method() === 'GET',
      { timeout: 10000 },
    )
    await page.reload()
    await expect(page.getByText(/\d+ results/)).toBeVisible({ timeout: 5000 })
    // Ensure listHistoryEntries has fully resolved before the test body runs
    await listHistoryDone
  })

  test('Generate tailored CV button is visible in the detail panel', async ({ page }) => {
    await page.getByRole('heading', { name: 'Senior Software Engineer' }).click()
    await expect(page.getByRole('button', { name: 'Generate tailored CV' })).toBeVisible()
  })

  test('Generate flow produces Regenerate CV and export button', async ({ page }) => {
    // First create a base CV so generation has something to tailor
    await createBaseCv(page)

    // Re-apply mocks after navigating away (route mocks are page-scoped)
    await setupAdzunaMock(page)
    await setupProxyMock(page)
    await page.goto('/search')
    await expect(page.getByText(/\d+ results/)).toBeVisible({ timeout: 5000 })
    await page.getByRole('heading', { name: 'Senior Software Engineer' }).click()

    // The generate button may show "Generate tailored CV" or "Regenerate CV"
    // depending on whether a previous session left a persisted result.
    const generateBtn = page.getByRole('button', { name: /Generate tailored CV|Regenerate CV/ })
    await expect(generateBtn).toBeVisible({ timeout: 5000 })
    // Use force:true to bypass any transient overlay/animation blocking the click
    await generateBtn.click({ force: true })

    // After generation, export button should appear
    await expect(page.getByRole('button', { name: /Export (PDF|DOCX|MD)/ })).toBeVisible({ timeout: 15000 })
    // Button label should now be "Regenerate CV"
    await expect(page.getByRole('button', { name: 'Regenerate CV' })).toBeVisible()
  })



  test('create job via editor navigates to /search on save', async ({ page }) => {
    await page.goto('/search')
    await clearLocalStorage(page)
    await page.reload()

    // Navigate to job editor
    await page.goto('/jobs/new')
    await expect(page.getByText('Add Job Posting')).toBeVisible()
    await page.getByPlaceholder('Frontend Developer').fill('Full Stack Engineer')
    await page.getByPlaceholder('Acme Corp').fill('TestCo')
    await page.getByPlaceholder('Paste the full job description here...').fill(
      'We need a Full Stack Engineer with React and TypeScript.\n- 3+ years experience\n- React\n- TypeScript'
    )
    await page.getByRole('button', { name: /^(Save|Saving)/ }).click()
    // On success, navigates back to /search
    await expect(page).toHaveURL(/\/search/, { timeout: 5000 })
  })
})
