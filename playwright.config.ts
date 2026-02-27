import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const authFile = path.join(import.meta.dirname, 'e2e', '.auth', 'user.json')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // ── Setup: authenticate once and save state ──────────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // ── Main tests: reuse saved auth state ───────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
