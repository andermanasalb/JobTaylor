import { test, expect } from '@playwright/test'
import { clearAppStorage } from './fixtures'

/**
 * CV Base page tests — fill in personal info, add experience/skills, save.
 * Uses in-memory repo so state resets on each page load.
 */

test.describe('CV Base', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cv')
    // Clear only app-owned keys; preserve Supabase auth tokens
    await clearAppStorage(page)
    await page.reload()
    // Ensure the editor tab is active (default)
    await expect(page.getByPlaceholder('Full name')).toBeVisible()
  })

  test('shows the three tabs: editor, preview, upload', async ({ page }) => {
    const tabs = page.getByRole('tablist')
    await expect(tabs.getByRole('tab', { name: 'editor' })).toBeVisible()
    await expect(tabs.getByRole('tab', { name: 'preview' })).toBeVisible()
    await expect(tabs.getByRole('tab', { name: 'upload' })).toBeVisible()
  })

  test('fills personal info fields', async ({ page }) => {
    await page.getByPlaceholder('Full name').fill('Jane Doe')
    await page.getByPlaceholder('email@example.com').fill('jane@example.com')
    await page.getByPlaceholder('+1 555 000 0000').fill('+1 555 000 0001')
    await page.getByPlaceholder('City, Country').fill('New York, USA')
    await page.getByPlaceholder('e.g. Senior Developer').fill('Software Engineer')

    await expect(page.getByPlaceholder('Full name')).toHaveValue('Jane Doe')
    await expect(page.getByPlaceholder('email@example.com')).toHaveValue('jane@example.com')
  })

  test('adds a skill via Enter key', async ({ page }) => {
    const skillInput = page.getByPlaceholder('Add a skill and press Enter...')
    await skillInput.fill('TypeScript')
    await skillInput.press('Enter')

    // Skill badge is a <span data-slot="badge"> (not a button) — locate by data-slot + text
    const skillBadge = page.locator('[data-slot="badge"]').filter({ hasText: 'TypeScript' }).first()
    await expect(skillBadge).toBeVisible()
  })

  test('removes a skill badge', async ({ page }) => {
    const skillInput = page.getByPlaceholder('Add a skill and press Enter...')
    await skillInput.fill('TypeScript')
    await skillInput.press('Enter')

    // Wait for the badge to appear
    const skillBadge = page.locator('[data-slot="badge"]').filter({ hasText: 'TypeScript' }).first()
    await expect(skillBadge).toBeVisible()

    // Click the badge to remove it (onClick handler on the Badge span)
    await skillBadge.click()
    await expect(skillBadge).not.toBeVisible()
  })

  test('adds an experience entry', async ({ page }) => {
    await page.getByRole('button', { name: 'Add' }).first().click()

    // Entry fields should appear (use .first() — prior tests may have left entries)
    await expect(page.getByPlaceholder('Job title').first()).toBeVisible()
    await page.getByPlaceholder('Job title').first().fill('Software Engineer')
    await page.getByPlaceholder('Company').first().fill('Acme Corp')
    await page.getByPlaceholder('Start (YYYY-MM)').first().fill('2020-01')

    await expect(page.getByPlaceholder('Job title').first()).toHaveValue('Software Engineer')
    await expect(page.getByPlaceholder('Company').first()).toHaveValue('Acme Corp')
  })

  test('removes an experience entry', async ({ page }) => {
    // Count existing entries before adding (may be non-zero from prior tests)
    const countBefore = await page.getByPlaceholder('Job title').count()

    // Add one entry
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByPlaceholder('Job title').first()).toBeVisible()
    await expect(page.getByPlaceholder('Job title')).toHaveCount(countBefore + 1)

    // Remove it
    await page.getByRole('button', { name: 'Remove experience' }).first().click()
    await expect(page.getByPlaceholder('Job title')).toHaveCount(countBefore)
  })

  test('preview tab renders with filled data', async ({ page }) => {
    // Fill minimum required fields
    await page.getByPlaceholder('Full name').fill('Preview User')
    await page.getByPlaceholder('email@example.com').fill('preview@test.com')

    // Switch to preview tab
    await page.getByRole('tab', { name: 'preview' }).click()

    // Preview should render the name — use heading to disambiguate from form field display
    await expect(page.getByRole('heading', { name: 'Preview User' })).toBeVisible()
  })

  test('upload tab shows paste area and parse button', async ({ page }) => {
    await page.getByRole('tab', { name: 'upload' }).click()

    await expect(page.getByPlaceholder('Paste the full text of your CV here…')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Parse and import' })).toBeVisible()
  })

  test('parse button is disabled when textarea is empty', async ({ page }) => {
    await page.getByRole('tab', { name: 'upload' }).click()
    const parseBtn = page.getByRole('button', { name: 'Parse and import' })
    await expect(parseBtn).toBeDisabled()
  })

  test('parse button enables when textarea has text', async ({ page }) => {
    await page.getByRole('tab', { name: 'upload' }).click()
    await page.getByPlaceholder('Paste the full text of your CV here…').fill('John Smith\njohn@test.com\n\nExperience: Engineer at Acme')
    await expect(page.getByRole('button', { name: 'Parse and import' })).toBeEnabled()
  })
})
