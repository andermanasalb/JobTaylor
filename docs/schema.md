# Schema — JobTaylor (Stage 1)

> Last updated: Stage 1 (Supabase local).
> Auth-scoped RLS policies are planned for Stage 2.

---

## Tables

### `public.base_cvs`

Stores structured JSON snapshots of a user's base CV.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `text` | Display name (e.g. "My CV") |
| `data` | `jsonb` | Full `BaseCv` JSON minus `id`, `name`, `createdAt`, `updatedAt` |
| `created_at` | `timestamptz` | Auto-set on insert |
| `updated_at` | `timestamptz` | Auto-updated via trigger |

Trigger: `base_cvs_updated_at` — calls `set_updated_at()` before each update.

---

### `public.job_postings`

Stores snapshots of job postings (pasted manually or imported).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `title` | `text` | Job title |
| `company` | `text` | Company name |
| `location` | `text` | Nullable |
| `remote` | `boolean` | Default `false` |
| `source` | `text` | CHECK: `linkedin`, `infojobs`, `indeed` |
| `url` | `text` | Source URL, nullable |
| `description` | `text` | Full job description (raw text) |
| `requirements` | `jsonb` | `{ skills, experienceYears?, education?, languages?, other? }` |
| `status` | `text` | CHECK: `saved`, `applied`, `interviewing`, `rejected`, `accepted`, `discarded` |
| `created_at` | `timestamptz` | Auto-set on insert |
| `updated_at` | `timestamptz` | Auto-updated via trigger |

Trigger: `job_postings_updated_at` — calls `set_updated_at()` before each update.

---

### `public.tailored_cvs`

Stores AI-generated tailored CVs derived from a base CV + job posting.
The `guardrails_applied` flag is always `true` — the system never fabricates experience.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `base_cv_id` | `uuid` | FK → `base_cvs(id)` ON DELETE CASCADE |
| `job_posting_id` | `uuid` | FK → `job_postings(id)` ON DELETE CASCADE |
| `tailored_data` | `jsonb` | Full tailored `BaseCv` JSON |
| `gaps` | `text[]` | Job requirements missing from the base CV |
| `suggestions` | `text[]` | Improvement hints (never fabricated claims) |
| `guardrails_applied` | `boolean` | Always `true` |
| `created_at` | `timestamptz` | Auto-set on insert |

Indexes: `tailored_cvs_base_cv_id_idx`, `tailored_cvs_job_posting_id_idx`

---

## Row Level Security (RLS)

RLS is enabled on all three tables. **Stage 1 uses permissive policies** (no auth yet).

| Table | Policy | Rule |
|---|---|---|
| `base_cvs` | `allow_all_base_cvs` | `USING (true)` — allow all |
| `job_postings` | `allow_all_job_postings` | `USING (true)` — allow all |
| `tailored_cvs` | `allow_all_tailored_cvs` | `USING (true)` — allow all |

**Stage 2 plan**: When auth is introduced, add a `user_id uuid references auth.users(id)` column to each table and replace the permissive policies with user-scoped ones:

```sql
-- Example (Stage 2):
CREATE POLICY "users_own_base_cvs"
  ON public.base_cvs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Migrations

| File | Description |
|---|---|
| `20260226000001_create_base_cvs.sql` | Creates `base_cvs` table + `set_updated_at` trigger function |
| `20260226000002_create_job_postings.sql` | Creates `job_postings` table |
| `20260226000003_create_tailored_cvs.sql` | Creates `tailored_cvs` table + indexes |
| `20260226000004_rls_policies.sql` | Enables RLS + permissive policies on all tables |

---

## Local development

```bash
# Start Supabase local stack (requires Docker)
supabase start

# Apply all migrations from scratch
supabase db reset

# Open Supabase Studio
open http://127.0.0.1:54323
```

Env vars needed in `.env.local`:
```
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<publishable key from `supabase status`>
```
