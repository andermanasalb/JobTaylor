import { test, expect } from '@playwright/test'
import { clearAppStorage } from './fixtures'

/**
 * Tailoring flow tests.
 *
 * The SearchPage's inline generate flow generates CVs in a detail panel
 * without navigating away from the search page.
 *
 * Tests cover:
 * 1. Inline generate flow (SearchPage → Generate CV)
 * 2. Creating a job via editor → saved → navigate to /search
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
  await expect(page.getByPlaceholder('Ana García')).toBeVisible()
  await page.getByPlaceholder('Ana García').fill('Test User')
  await page.getByPlaceholder('ana@example.com').fill('test@example.com')
  // Wait for the 800ms auto-save debounce to fire, ensuring the CV is persisted
  // before navigating away (the unmount save also fires, but this is belt-and-suspenders)
  await page.waitForTimeout(1000)
}

test.describe('Inline tailoring (SearchPage)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so localStorage is accessible, then clear app keys only.
    await page.goto('/search')
    await clearAppStorage(page)
    await page.reload()
    await expect(page.getByText(/\d+ results/)).toBeVisible({ timeout: 5000 })
  })

  test('Generate tailored CV button is visible in the detail panel', async ({ page }) => {
    await page.getByRole('heading', { name: 'Senior Software Engineer' }).click()
    await expect(page.getByRole('button', { name: 'Generate tailored CV' })).toBeVisible()
  })

  test('Generate flow produces Regenerate CV and export button', async ({ page }) => {
    // First create a base CV so generation has something to tailor
    await createBaseCv(page)

    await page.goto('/search')
    await expect(page.getByText(/\d+ results/)).toBeVisible({ timeout: 5000 })
    await page.getByRole('heading', { name: 'Senior Software Engineer' }).click()

    const generateBtn = page.getByRole('button', { name: 'Generate tailored CV' })
    await expect(generateBtn).toBeVisible()
    await generateBtn.click()

    // FakeAiClient is synchronous — after generation, export button should appear
    await expect(page.getByRole('button', { name: /Export (PDF|DOCX|MD)/ })).toBeVisible({ timeout: 5000 })
    // Button label should now be "Regenerate CV"
    await expect(page.getByRole('button', { name: 'Regenerate CV' })).toBeVisible()
  })

  test('after generating, history shows Generated badge', async ({ page }) => {
    await createBaseCv(page)

    await page.goto('/search')
    await expect(page.getByText(/\d+ results/)).toBeVisible({ timeout: 5000 })
    await page.getByRole('heading', { name: 'Senior Software Engineer' }).click()
    await page.getByRole('button', { name: 'Generate tailored CV' }).click()
    await expect(page.getByRole('button', { name: /Export (PDF|DOCX|MD)/ })).toBeVisible({ timeout: 5000 })

    // Navigate to history
    await page.goto('/history')
    await expect(page.getByText('Senior Software Engineer').first()).toBeVisible()
    await expect(page.getByText('Generated').first()).toBeVisible()
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
