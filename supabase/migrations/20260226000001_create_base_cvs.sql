-- base_cvs: stores the structured JSON of a base CV
create table if not exists public.base_cvs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My CV',
  data        jsonb not null,             -- full BaseCv JSON (personalInfo, summary, experience, etc.)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- keep updated_at current on every update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger base_cvs_updated_at
  before update on public.base_cvs
  for each row execute procedure public.set_updated_at();
