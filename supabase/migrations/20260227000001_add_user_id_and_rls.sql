-- Stage 1.5: Add user_id to all tables and enforce user-scoped RLS.
-- Replaces the permissive USING (true) policies from migration 20260226000004.

-- ── base_cvs ──────────────────────────────────────────────────────────────────

ALTER TABLE public.base_cvs
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive policy
DROP POLICY IF EXISTS "allow_all_base_cvs" ON public.base_cvs;

-- User-scoped policy: each user sees and modifies only their own rows
CREATE POLICY "base_cvs_user_policy"
  ON public.base_cvs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── job_postings ──────────────────────────────────────────────────────────────

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "allow_all_job_postings" ON public.job_postings;

CREATE POLICY "job_postings_user_policy"
  ON public.job_postings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── tailored_cvs ──────────────────────────────────────────────────────────────

ALTER TABLE public.tailored_cvs
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "allow_all_tailored_cvs" ON public.tailored_cvs;

CREATE POLICY "tailored_cvs_user_policy"
  ON public.tailored_cvs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
