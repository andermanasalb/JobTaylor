import { test as setup, expect } from '@playwright/test'
import path from 'path'

/**
 * Auth setup — runs once before all test projects.
 *
 * Signs in with a dedicated E2E test account.
 * If the account doesn't exist, registers it first (email confirmation is
 * disabled in local Supabase, so the account is immediately usable).
 *
 * Saves browser storage state so all subsequent test projects start
 * already authenticated — no repeated logins per test.
 */

export const TEST_EMAIL = 'e2e@jobtaylor.local'
export const TEST_PASSWORD = 'TestPassword123!'
export const TEST_NAME = 'E2E Test User'

export const authFile = path.join(import.meta.dirname, '.auth', 'user.json')

/** Fills the login form and clicks submit. Uses attribute selectors to avoid strict-mode conflicts. */
async function fillAndSubmitLogin(page: import('@playwright/test').Page, email: string, password: string, buttonName: string) {
  await page.locator('input[aria-label="Email"]').fill(email)
  await page.locator('input[aria-label="Contraseña"]').fill(password)
  await page.getByRole('button', { name: buttonName }).click()
}

setup('authenticate', async ({ page }) => {
  // ── Attempt sign-in ────────────────────────────────────────────────────────
  await page.goto('/login')
  await expect(page.locator('input[aria-label="Email"]')).toBeVisible()

  await fillAndSubmitLogin(page, TEST_EMAIL, TEST_PASSWORD, 'Iniciar sesión')

  const signedIn = await page.waitForURL(/\/search/, { timeout: 5000 }).then(() => true).catch(() => false)

  if (!signedIn) {
    // ── Sign-in failed → register the account, then sign in ─────────────────
    await page.goto('/login')
    await expect(page.locator('input[aria-label="Email"]')).toBeVisible()

    // Switch to register mode
    await page.getByText('Regístrate').click()
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeVisible()

    // Fill registration form: name + email + password + confirm password
    await page.locator('input[aria-label="Nombre completo"]').fill(TEST_NAME)
    await page.locator('input[aria-label="Email"]').fill(TEST_EMAIL)
    await page.locator('input[aria-label="Contraseña"]').fill(TEST_PASSWORD)
    await page.locator('input[aria-label="Confirmar contraseña"]').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Crear cuenta' }).click()

    // After registration the form shows a success message
    await expect(page.getByText('¡Cuenta creada!')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()

    // Now sign in
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
    await fillAndSubmitLogin(page, TEST_EMAIL, TEST_PASSWORD, 'Iniciar sesión')

    await page.waitForURL(/\/search/, { timeout: 10000 })
  }

  // Save auth state (cookies + localStorage with Supabase tokens) for reuse
  await page.context().storageState({ path: authFile })
})
