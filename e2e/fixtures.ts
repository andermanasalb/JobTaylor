import { test as base } from '@playwright/test'

/**
 * Shared test utilities for JobTaylor E2E tests.
 */

/**
 * Clears only app-owned localStorage keys (prefixed "jobtaylor-").
 * Does NOT clear Supabase auth tokens (prefixed "sb-"), which are needed
 * to keep the authenticated session alive across tests.
 *
 * Must be called AFTER a navigation so the page context has a real origin.
 */
export async function clearAppStorage(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('jobtaylor-'))
    keysToRemove.forEach(k => localStorage.removeItem(k))
  })
}

export { base as test }
