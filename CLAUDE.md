# Claude Project Rules — JobTaylor

These are the rules you must follow on every prompt, without exception.
Read this file fully before writing any code.

---

## 1. Product

JobTaylor is a web app that helps candidates tailor their CV to a specific job posting using AI.
The AI rewrites and reorders the existing CV content to highlight what is most relevant — it never
invents experience, titles, dates, employers, degrees, or certifications.

Core flow:
1. User creates a Base CV (structured JSON, importable from PDF/DOCX).
2. User searches real job postings via Adzuna API.
3. User triggers tailoring: AI adapts the Base CV to the selected posting.
4. User downloads the tailored CV as PDF or DOCX.
5. User reviews past tailored CVs in the History page.

---

## 2. Stack (current, accurate)

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styles | Tailwind CSS v4 + shadcn/ui + Radix UI |
| Routing | React Router v7 |
| Auth + DB | Supabase (local: Docker via Supabase CLI) |
| AI (local) | Ollama — model `qwen2.5:0.5b`, running on `localhost:11434` |
| AI (proxy) | Express proxy on `localhost:3001` (`npm run proxy`) — avoids CORS |
| AI (test) | `FakeAiClient` — deterministic, no network, unit tests only |
| Job search | Adzuna API (client-side, keys in `.env.local`) |
| Export | jsPDF (PDF) + docx (DOCX) — fully client-side |
| i18n | react-i18next (ES / EN) |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright |
| Linting | ESLint + Prettier |
| Git hooks | Husky (pre-commit: `quality`, pre-push: `verify`) |

---

## 3. Architecture

The project follows **Clean Architecture with Ports & Adapters**.

### Folder structure (actual)

```
src/
  app/           # Composition root, router, global contexts (AppDepsContext)
  features/      # Feature slices — each has domain/ + application/ + ui/
    auth/
    cv-base/
    job-postings/
    tailoring/
    history/
    settings/
  infra/         # Port implementations (adapters)
    ai/          # OllamaAiClient, FakeAiClient
    export/      # exportTailoredCv (PDF + DOCX)
    job-feed/    # Adzuna API client
    memory/      # In-memory repos + LocalStorage repos (used in tests and fallback)
    supabase/    # Supabase repos (production)
    cv-parser/   # PDF/DOCX import
    enrichment/  # Job posting enrichment
  shared/        # Cross-cutting UI components, hooks, contexts
  lib/           # Minimal shared helpers (e.g. cn())
```

### Dependency rule (enforce always)

```
UI → application (use cases) → domain (pure logic)
                                      ↑
infra implements ports          (no external dependencies)
```

- `domain/` has zero dependencies on React, Supabase, or any library.
- `application/` has zero dependencies on React or Supabase SDK.
- Ports (interfaces) live in `src/features/[feature]/application/ports/` or `src/infra/`.
- Infra implements ports; it is never imported by domain or application directly.

### Composition root

All dependency wiring happens in `src/app/` (AppDepsContext). Swapping memory ↔ Supabase is
controlled by the `VITE_USE_SUPABASE` env var — no other file should contain this switch.

---

## 4. Code rules (non-negotiable)

- **No `private` keyword in class constructors** — the project has `erasableSyntaxOnly` enabled in TypeScript. Use plain constructor parameters.
- **No `date-fns`** — use native `Date` and `Intl` APIs only.
- **No Next.js `Link`** — use React Router `<Link>` or `useNavigate`. For external URLs use a plain `<a href target="_blank" rel="noopener noreferrer">`.
- **No hardcoded strings visible to the user** — all UI text goes through `react-i18next` (`useTranslation` / `t()`). Add keys to both `src/shared/i18n/es.json` and `src/shared/i18n/en.json`.
- **No secrets in frontend code** — API keys go in `.env.local`, never committed.
- **Use `npm`**, not pnpm or yarn.
- Keep modules small. Prefer adding a new file over growing an existing one.
- When making a significant architectural decision, create an ADR in `docs/adr/`.

---

## 5. Workflow (follow on every task)

### Plan first
Before writing any code:
1. State briefly what will change and which files will be touched.
2. List which tests will be added or modified.
3. If requirements are ambiguous, ask (max 5 questions) and stop until answered.

### TDD for domain and application logic
- RED: write a failing test first.
- GREEN: write the minimal code to make it pass.
- REFACTOR: improve without changing behavior.
- Unit tests use in-memory repos and `FakeAiClient` only — no network, no Supabase.

### One slice at a time
Implement one user-visible feature per iteration. Stop once acceptance criteria and tests pass.

---

## 6. Quality gates (run after every code change)

```bash
npm run typecheck   # always run after any code change
npm run quality     # lint + typecheck + test — run before closing an iteration
npm run verify      # quality + test:e2e + build — run before pushing
```

### Known false positive — ignore always
`src/features/auth/ui/components/PasswordInput.test.tsx` may show LSP errors in the editor.
These are false positives caused by the test tsconfig. **Never modify the file to silence them.**

---

## 7. Commands

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (requires Supabase running)
npm run proxy        # start Ollama proxy on localhost:3001
npm run build        # production build (tsc + vite build)
npm run preview      # preview production build

npm run test         # unit tests (Vitest)
npm run test:watch   # unit tests in watch mode
npm run test:e2e     # E2E tests (Playwright)

npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run format       # Prettier
npm run quality      # lint + typecheck + test
npm run verify       # quality + test:e2e + build
```

Supabase:
```bash
npx supabase start       # start local Supabase (Docker required)
npx supabase db reset    # reset DB and re-apply all migrations
```

---

## 8. Testing rules

### Unit tests (Vitest)
- Cover domain logic and application use cases.
- Always use `FakeAiClient` and in-memory repos — never real network calls.
- Located in `src/features/[feature]/` or `src/infra/` alongside the code they test.

### E2E tests (Playwright)
- Cover the full user flow with real Supabase local auth.
- Located in `e2e/`.
- Must be stable — no flaky sleeps, use proper `waitFor` / locators.
- Do not require external network (Adzuna, Ollama) — mock at the boundary if needed.

### Coverage
- Domain and application use cases must have unit test coverage.
- UI components are tested via E2E, not unit tests (unless they contain logic).

---

## 9. Security rules (OWASP — already implemented, do not regress)

The following security measures are already in place — do not remove or weaken them:

- **Password validation** (`validatePassword`): minimum 12 characters, uppercase, lowercase, number, special character.
- **`PasswordInput` component**: real-time strength bar and requirements checklist.
- **Rate limiting** (frontend): 3 failed login attempts → 60-second lockout.
- **No user enumeration**: error messages never reveal whether an email exists.
- **`returnTo`** post-login redirect.
- **Row Level Security (RLS)**: every Supabase table has RLS policies — each user sees only their own data.
- All new Supabase tables must include RLS policies from day one.

---

## 10. AI guardrails (critical — never relax)

These constraints must appear explicitly in every AI prompt sent to the tailoring use case:

- Never invent experience, employers, job titles, dates, degrees, or certifications.
- Tailoring may only rewrite, reorder, and emphasize content that already exists in the Base CV JSON.
- If the job posting requires something the candidate does not have, output a gap note — do not fabricate it.
- `FakeAiClient` is for unit tests only. Never use it in production composition root.

---

## 11. Environment variables

```env
# Supabase local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<from supabase start output>
VITE_USE_SUPABASE=true

# Adzuna job search
VITE_ADZUNA_APP_ID=
VITE_ADZUNA_APP_KEY=

# AI provider: fake | ollama
VITE_AI_PROVIDER=ollama
VITE_PROXY_URL=http://localhost:3001
```

`.env.local` is gitignored. Never commit secrets. Never expose API keys in frontend bundles
(Adzuna keys are currently client-side and must move to a serverless function before production).

---

## 12. What is NOT implemented (do not assume otherwise)

- No Sentry or error monitoring.
- No Stripe or payments.
- No password reset / "forgot password" flow.
- No OAuth / Google login.
- No 2FA.
- No AI cloud provider (OpenAI, Gemini, etc.) — only Ollama and FakeAiClient exist.
- No Vercel deployment yet.
- No Supabase Cloud yet — only local Docker.

If any of these are to be added, treat them as a new feature and plan accordingly.
