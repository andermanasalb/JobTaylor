-- Fix tailored_cvs: Adzuna job IDs are plain strings, not UUIDs.
-- Drop the broken FK constraint and change job_posting_id from uuid to text.
-- Also add job_title, job_description, and score columns so the History page
-- can download CVs without relying on the in-memory generation queue.

-- 1. Drop the broken FK (job_posting_id uuid → job_postings.id)
ALTER TABLE public.tailored_cvs
  DROP CONSTRAINT IF EXISTS tailored_cvs_job_posting_id_fkey;

-- 2. Change job_posting_id from uuid to text
ALTER TABLE public.tailored_cvs
  ALTER COLUMN job_posting_id TYPE text USING job_posting_id::text;

-- 3. Add new metadata columns
ALTER TABLE public.tailored_cvs
  ADD COLUMN IF NOT EXISTS job_title       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS score           integer;

-- 4. Unique index so upsert works correctly (one tailored CV per user per job)
DROP INDEX IF EXISTS tailored_cvs_user_job_idx;
CREATE UNIQUE INDEX tailored_cvs_user_job_idx
  ON public.tailored_cvs (user_id, job_posting_id);
