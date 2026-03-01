-- history_entries: stores job search history per user
create table if not exists public.history_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  job_id        text not null,
  job_title     text not null,
  company       text not null,
  region        text not null default '',
  status        text not null default 'saved' check (status in ('saved', 'generated', 'exported')),
  created_at    timestamptz not null default now(),
  exported_at   timestamptz
);

-- One entry per user+job (enforce at DB level)
create unique index if not exists history_entries_user_job_idx
  on public.history_entries (user_id, job_id);

-- Enable RLS
alter table public.history_entries enable row level security;

-- User-scoped policy: each user sees and modifies only their own rows
create policy "history_entries_user_policy"
  on public.history_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
