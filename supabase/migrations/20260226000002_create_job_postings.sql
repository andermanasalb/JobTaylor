-- job_postings: stores snapshots of job postings
create table if not exists public.job_postings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  company       text not null,
  location      text,
  remote        boolean not null default false,
  source        text not null check (source in ('linkedin', 'infojobs', 'indeed')),
  url           text,
  description   text not null,
  requirements  jsonb not null default '{"skills":[],"experience":null,"education":null}'::jsonb,
  status        text not null default 'saved' check (status in ('saved', 'applied', 'interviewing', 'rejected', 'accepted', 'discarded')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger job_postings_updated_at
  before update on public.job_postings
  for each row execute procedure public.set_updated_at();
