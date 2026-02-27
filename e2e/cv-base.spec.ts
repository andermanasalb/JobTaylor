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
    await expect(page.getByPlaceholder('Ana García')).toBeVisible()
  })

  test('shows the three tabs: editor, preview, upload', async ({ page }) => {
    const tabs = page.getByRole('tablist')
    await expect(tabs.getByRole('tab', { name: 'editor' })).toBeVisible()
    await expect(tabs.getByRole('tab', { name: 'preview' })).toBeVisible()
    await expect(tabs.getByRole('tab', { name: 'upload' })).toBeVisible()
  })

  test('fills personal info fields', async ({ page }) => {
    await page.getByPlaceholder('Ana García').fill('Jane Doe')
    await page.getByPlaceholder('ana@example.com').fill('jane@example.com')
    await page.getByPlaceholder('+34 600 000 000').fill('+1 555 000 0000')
    await page.getByPlaceholder('Madrid, Spain').fill('New York, USA')
    await page.getByPlaceholder('Senior Frontend Developer').fill('Software Engineer')

    await expect(page.getByPlaceholder('Ana García')).toHaveValue('Jane Doe')
    await expect(page.getByPlaceholder('ana@example.com')).toHaveValue('jane@example.com')
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

    // Entry fields should appear
    await expect(page.getByPlaceholder('Job title')).toBeVisible()
    await page.getByPlaceholder('Job title').fill('Software Engineer')
    await page.getByPlaceholder('Company').fill('Acme Corp')
    await page.getByPlaceholder('Start (YYYY-MM)').fill('2020-01')

    await expect(page.getByPlaceholder('Job title')).toHaveValue('Software Engineer')
    await expect(page.getByPlaceholder('Company')).toHaveValue('Acme Corp')
  })

  test('removes an experience entry', async ({ page }) => {
    // Add one entry first
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByPlaceholder('Job title')).toBeVisible()

    // Remove it
    await page.getByRole('button', { name: 'Remove experience' }).click()
    await expect(page.getByPlaceholder('Job title')).not.toBeVisible()
  })

  test('preview tab renders with filled data', async ({ page }) => {
    // Fill minimum required fields
    await page.getByPlaceholder('Ana García').fill('Preview User')
    await page.getByPlaceholder('ana@example.com').fill('preview@test.com')

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
