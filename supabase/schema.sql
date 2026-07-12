-- Household Recipe Manager schema
-- Run this once in the Supabase SQL editor.

create table recipes (
  id                        uuid primary key default gen_random_uuid(),
  title                     text not null,
  source_url                text,
  status                    text not null default 'inbox'
                            check (status in ('inbox', 'approved')),
  prep_time_minutes         integer,
  servings_base             integer not null default 4,
  -- PRD gap fix: the parser returns this and the detail view displays it
  -- ("servings not stated in source" note), but the original schema had no
  -- column for it.
  servings_stated_in_source boolean not null default false,
  ingredients               jsonb not null,
  steps                     jsonb not null,
  raw_capture_text          text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Keep updated_at honest (PRD gap fix: without this, it never changes).
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on recipes
  for each row execute function set_updated_at();

-- RLS: enabled, with a deliberately permissive anon policy (PRD §3/§7).
-- This is defense in depth for the anon key that ships in the frontend
-- bundle — not household-internal privacy.
alter table recipes enable row level security;

create policy "anon full access" on recipes
  for all
  to anon
  using (true)
  with check (true);
