-- tailored_cvs: AI-generated tailored CV derived from a base CV + job posting
create table if not exists public.tailored_cvs (
  id               uuid primary key default gen_random_uuid(),
  base_cv_id       uuid not null references public.base_cvs(id) on delete cascade,
  job_posting_id   uuid not null references public.job_postings(id) on delete cascade,
  tailored_data    jsonb not null,          -- tailored BaseCv JSON (no invented content)
  gaps             text[] not null default '{}',
  suggestions      text[] not null default '{}',
  guardrails_applied boolean not null default true,
  created_at       timestamptz not null default now()
);

create index tailored_cvs_base_cv_id_idx    on public.tailored_cvs(base_cv_id);
create index tailored_cvs_job_posting_id_idx on public.tailored_cvs(job_posting_id);
