import { test, expect } from '@playwright/test'

test('app loads and renders root page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('JobTaylor')
})

test('root redirect goes to /search', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/search/)
})
