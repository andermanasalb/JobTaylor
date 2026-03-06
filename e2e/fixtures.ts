import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Shared test utilities for JobTaylor E2E tests.
 */

/**
 * Clears only app-owned localStorage keys (prefixed "jobtaylor-") and all
 * sessionStorage keys used by SearchPage (prefixed "search.").
 * Does NOT clear Supabase auth tokens (prefixed "sb-"), which are needed
 * to keep the authenticated session alive across tests.
 *
 * After clearing, restores two required keys so the app boots correctly:
 *   - jobtaylor-last-activity : prevents inactivity sign-out on reload
 *   - jobtaylor-settings      : forces English UI (outputLanguage: EN)
 *
 * Must be called AFTER a navigation so the page context has a real origin.
 */
export async function clearAppStorage(page: Page) {
  await page.evaluate(() => {
    // Clear app-owned localStorage keys
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('jobtaylor-'))
    keysToRemove.forEach(k => localStorage.removeItem(k))
    // Re-stamp activity so the inactivity guard (AuthContext) does not sign the
    // user out immediately on reload due to a missing timestamp.
    localStorage.setItem('jobtaylor-last-activity', String(Date.now()))
    // Force English UI so all tests can use English locators.
    localStorage.setItem('jobtaylor-settings', JSON.stringify({ outputLanguage: 'EN' }))
    // Clear sessionStorage keys used by SearchPage to avoid stale cached state
    // (listings, query, scores, enriched jobs, selected job, etc.) bleeding
    // across tests running in the same browser context.
    const sessionKeysToRemove = Object.keys(sessionStorage).filter(k => k.startsWith('search.'))
    sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k))
  })
}

/**
 * Intercepts Adzuna API calls and returns mock listings in Adzuna response
 * format so tests are deterministic and do not depend on a real API key.
 *
 * Must be called before navigating to a page that triggers a search.
 * The mock data mirrors `searchMock.ts` so tests can reference job titles
 * such as "Senior Software Engineer", "Frontend Engineer", "Backend Engineer".
 */
export async function setupAdzunaMock(page: Page) {
  await page.route('https://api.adzuna.com/**', async route => {
    const url = route.request().url()
    const params = new URL(url).searchParams
    const titleOnly = (params.get('title_only') ?? '').toLowerCase()
    const whatOr = (params.get('what_or') ?? '').toLowerCase()
    const isRemoteOnly = whatOr.includes('remote')

    const allJobs = [
      {
        id: 'job-1',
        title: 'Senior Software Engineer',
        company: { display_name: 'BasqueCloud' },
        location: { display_name: 'Bilbao, País Vasco' },
        description: 'TypeScript React Node.js cloud infrastructure team.',
        created: '2026-02-20T00:00:00Z',
        redirect_url: 'https://example.com/job-1',
      },
      {
        id: 'job-2',
        title: 'Backend Engineer',
        company: { display_name: 'AeroTech' },
        location: { display_name: 'Madrid, Spain' },
        description: 'Python Go microservices architecture.',
        created: '2026-02-18T00:00:00Z',
        redirect_url: 'https://example.com/job-2',
      },
      {
        id: 'job-4',
        title: 'Full Stack Developer',
        company: { display_name: 'BasqueCloud' },
        location: { display_name: 'Remote (EU)' },
        description: 'Next.js TypeScript Tailwind. remote position.',
        created: '2026-02-22T00:00:00Z',
        redirect_url: 'https://example.com/job-4',
      },
      {
        id: 'job-7',
        title: 'Frontend Engineer',
        company: { display_name: 'BasqueCloud' },
        location: { display_name: 'Barcelona, Spain' },
        description: 'React CSS Accessibility design system.',
        created: '2026-02-19T00:00:00Z',
        redirect_url: 'https://example.com/job-7',
      },
      {
        id: 'job-10',
        title: 'Platform Engineer',
        company: { display_name: 'BasqueCloud' },
        location: { display_name: 'Madrid, Spain' },
        description: 'Go Kubernetes platform remote-first.',
        created: '2026-02-16T00:00:00Z',
        redirect_url: 'https://example.com/job-10',
      },
    ]

    let filtered = allJobs

    // Filter by keyword (title_only param)
    if (titleOnly) {
      filtered = filtered.filter(j => j.title.toLowerCase().includes(titleOnly))
    }

    // Filter by remote (what_or contains "remote")
    if (isRemoteOnly) {
      filtered = filtered.filter(j =>
        j.description.toLowerCase().includes('remote') ||
        j.location.display_name.toLowerCase().includes('remote'),
      )
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: filtered.length, results: filtered }),
    })
  })
}

/**
 * Intercepts local proxy calls (localhost:3001) so E2E tests do not need
 * a running proxy or Gemini API key.
 *
 * Mocked endpoints:
 *   POST /tailor   → returns a minimal valid AiTailorResult
 *   POST /score    → returns a fixed score of 80
 *   POST /enrich   → returns an empty enrichment object
 *   POST /parse-cv → returns an empty parsed CV object
 *   GET  /health   → returns { proxy: 'ok', gemini: 'mocked' }
 */
export async function setupProxyMock(page: Page) {
  await page.route('http://localhost:3001/**', async route => {
    const url = route.request().url()
    const path = new URL(url).pathname

    if (path === '/tailor') {
      const body = route.request().postDataJSON() as { cv?: Record<string, unknown> } | null
      const cv = body?.cv ?? {}
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tailoredCv: {
            personalInfo: (cv as { personalInfo?: unknown }).personalInfo ?? {
              fullName: 'Test User',
              email: 'test@example.com',
              phone: '',
              location: '',
              title: '',
            },
            summary: 'Experienced professional applying for the role.',
            experience: (cv as { experience?: unknown }).experience ?? [],
            education: (cv as { education?: unknown }).education ?? [],
            skills: (cv as { skills?: unknown }).skills ?? [],
            languages: (cv as { languages?: unknown }).languages ?? [],
            links: (cv as { links?: unknown }).links ?? [],
          },
          gaps: [],
          suggestions: [],
        }),
      })
    } else if (path === '/score') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ score: 80 }),
      })
    } else if (path === '/enrich') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          description: 'Mock enriched description.',
          requirements: [],
          niceToHave: [],
          techStack: [],
          aboutCompany: null,
        }),
      })
    } else if (path === '/parse-cv') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fullName: '',
          email: '',
          phone: '',
          location: '',
          title: '',
          summary: '',
          experience: [],
          education: [],
          skills: [],
          languages: [],
          links: [],
        }),
      })
    } else if (path === '/health') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ proxy: 'ok', gemini: 'mocked' }),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Deletes all history_entries rows for the currently authenticated user via
 * the Supabase REST API. Must be called after a navigation so the page
 * context has access to the Supabase session stored in localStorage.
 *
 * Uses the user's own JWT (from the Supabase session in localStorage) so
 * Row Level Security allows the delete. Falls back silently if the session
 * is not found (e.g. in tests where auth is not set up).
 */
export async function clearSupabaseHistory(page: Page) {
  await page.evaluate(async () => {
    const SUPABASE_URL = 'http://127.0.0.1:54321'
    const ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
    // Find the Supabase session token stored by the auth SDK (key starts with "sb-")
    const sessionKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!sessionKey) return
    let accessToken: string | undefined
    try {
      const session = JSON.parse(localStorage.getItem(sessionKey) ?? '{}')
      accessToken = session?.access_token
    } catch {
      return
    }
    if (!accessToken) return
    // Delete all history_entries for this user (RLS ensures only their rows are deleted)
    await fetch(`${SUPABASE_URL}/rest/v1/history_entries?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
  })
}

/**
 * Mocks all Supabase GET requests to the history_entries table so they
 * return an empty array instantly. POST/PUT/DELETE requests are passed through
 * to real Supabase.
 *
 * Use this in test files that do NOT specifically test history persistence
 * (e.g. search.spec.ts) to achieve two goals:
 *   1. Clean state: savedJobs and historyStatuses always start empty.
 *   2. No race condition: the mock resolves synchronously during page load,
 *      so listHistoryEntries completes before any test body can click a button.
 *   3. No cross-file interference: avoids calling clearSupabaseHistory, which
 *      runs in parallel and can wipe entries from other test files.
 *
 * Must be called BEFORE page.reload() so the route intercept is active when
 * SearchPage fires listHistoryEntries on mount.
 */
export async function setupSupabaseHistoryMock(page: Page) {
  await page.route('http://127.0.0.1:54321/rest/v1/history_entries*', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      })
    } else {
      // Allow writes (POST/PATCH/DELETE) to reach real Supabase.
      await route.continue()
    }
  })
}

export { base as test }
