-- Migration 0005: company_people table
-- The roster of humans attached to an archive (officers, employees,
-- representatives). For "company" entities this is who signs forms /
-- whose IDs appear in filings. For "individual" entities the entity is
-- itself the person, so this table is usually unused there.

create table if not exists public.company_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('owner', 'officer', 'employee', 'representative')),
  position_title text,
  tin text,
  sss_no text,
  philhealth_no text,
  pagibig_no text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_people_company_id_idx on public.company_people(company_id);
create index if not exists company_people_user_id_idx on public.company_people(user_id);

drop trigger if exists company_people_updated_at on public.company_people;
create trigger company_people_updated_at
  before update on public.company_people
  for each row execute function public.handle_updated_at();

alter table public.company_people enable row level security;

drop policy if exists "Users can view own people" on public.company_people;
create policy "Users can view own people"
  on public.company_people for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own people" on public.company_people;
create policy "Users can insert own people"
  on public.company_people for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own people" on public.company_people;
create policy "Users can update own people"
  on public.company_people for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own people" on public.company_people;
create policy "Users can delete own people"
  on public.company_people for delete
  using (auth.uid() = user_id);
