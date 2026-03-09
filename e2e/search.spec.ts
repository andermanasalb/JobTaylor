import { test, expect } from '@playwright/test'
import { clearAppStorage, setupProxyMock, setupSupabaseHistoryMock } from './fixtures'

/**
 * Search page tests — filtering, saving/unsaving jobs, job detail panel.
 * Adzuna API calls are intercepted and replaced with mock data so tests
 * are deterministic regardless of real API keys in the environment.
 */

test.describe('Search page', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Adzuna API before navigating so no real network calls are made.
    await setupProxyMock(page)
    // Navigate first so localStorage is accessible, then clear app keys only.
    await page.goto('/search')
    await clearAppStorage(page)
    // Mock Supabase history GET → [] so listHistoryEntries resolves instantly with
    // clean state (no race condition) and does not interfere with other test files.
    await setupSupabaseHistoryMock(page)
    await page.reload()
    // Wait for the loading skeleton to finish (600ms timer in SearchPage)
    await expect(page.getByText(/\d+ results/)).toBeVisible({ timeout: 5000 })
  })

  test('shows job listing cards after loading', async ({ page }) => {
    // First mock job title should be visible
    await expect(page.getByRole('heading', { name: 'Senior Software Engineer' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Frontend Engineer' })).toBeVisible()
  })

  test('filters by keyword', async ({ page }) => {
    await page.getByPlaceholder('Search by role, title or technology...').fill('Backend')
    await expect(page.getByRole('heading', { name: 'Backend Engineer' })).toBeVisible()
    // Unrelated job should not be visible
    await expect(page.getByRole('heading', { name: 'Senior Software Engineer' })).not.toBeVisible()
  })

  test('clear filters restores all results', async ({ page }) => {
    await page.getByPlaceholder('Search by role, title or technology...').fill('zzznomatch')
    await expect(page.getByText('No results')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByRole('heading', { name: 'Senior Software Engineer' })).toBeVisible()
  })

  test('clicking a job card shows it in the detail panel', async ({ page }) => {
    await page.getByRole('heading', { name: 'Senior Software Engineer' }).click()
    // Detail panel heading (h2) should appear on the right
    await expect(page.getByRole('heading', { name: 'Senior Software Engineer', level: 2 })).toBeVisible()
  })

  test('save button on job card toggles to saved state', async ({ page }) => {
    // Use attribute selector to target only the actual bookmark button, not the card
    const firstSaveBtn = page.locator('button[aria-label="Save posting"]').first()
    await expect(firstSaveBtn).toBeVisible()
    await firstSaveBtn.click()
    // After saving, the button label changes to "Unsave posting"
    await expect(page.locator('button[aria-label="Unsave posting"]').first()).toBeVisible({ timeout: 3000 })
  })

  test('unsave removes the saved state', async ({ page }) => {
    const firstSaveBtn = page.locator('button[aria-label="Save posting"]').first()
    await firstSaveBtn.click()
    // Wait for it to become Unsave
    const unsaveBtn = page.locator('button[aria-label="Unsave posting"]').first()
    await expect(unsaveBtn).toBeVisible({ timeout: 3000 })
    await unsaveBtn.click()
    // Back to Save posting
    await expect(page.locator('button[aria-label="Save posting"]').first()).toBeVisible({ timeout: 3000 })
  })

  test('detail panel shows Save/Saved button when a job is selected', async ({ page }) => {
    await page.getByRole('heading', { name: 'Senior Software Engineer' }).click()
    // The detail panel Save/Saved button should be visible
    await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeVisible()
  })

  test('detail panel shows Generate tailored CV button', async ({ page }) => {
    await page.getByRole('heading', { name: 'Senior Software Engineer' }).click()
    await expect(page.getByRole('button', { name: 'Generate tailored CV' })).toBeVisible()
  })

  test('remote only toggle filters to remote jobs', async ({ page }) => {
    // Toggle remote-only switch
    await page.getByRole('switch', { name: /Remote only/i }).click()
    // On-site job "Backend Engineer" (Madrid, On-site) should not be visible
    await expect(page.getByRole('heading', { name: 'Backend Engineer' })).not.toBeVisible()
  })
})
