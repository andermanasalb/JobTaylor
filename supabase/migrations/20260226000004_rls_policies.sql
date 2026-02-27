-- Stage 1: Enable RLS on all tables and add permissive policies.
-- NOTE: These are intentionally permissive (no auth yet).
-- In Stage 2 (auth), replace USING (true) with USING (auth.uid() = user_id)
-- and add a user_id column to each table.

-- base_cvs
ALTER TABLE public.base_cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_base_cvs"
  ON public.base_cvs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- job_postings
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_job_postings"
  ON public.job_postings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- tailored_cvs
ALTER TABLE public.tailored_cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_tailored_cvs"
  ON public.tailored_cvs
  FOR ALL
  USING (true)
  WITH CHECK (true);
