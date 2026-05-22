-- Migration 0001: companies table
-- Multi-company support per user. Each row owned by the user who created it.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tin text,
  sec_no text,
  dti_no text,
  address text,
  city text,
  phone text,
  email text,
  vat_status text check (vat_status in ('vat_registered', 'non_vat')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast per-user lookups
create index if not exists companies_user_id_idx on public.companies(user_id);

-- Keep updated_at fresh
drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.handle_updated_at();

-- Row Level Security: users can only see and modify their own companies
alter table public.companies enable row level security;

drop policy if exists "Users can view own companies" on public.companies;
create policy "Users can view own companies"
  on public.companies for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own companies" on public.companies;
create policy "Users can insert own companies"
  on public.companies for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own companies" on public.companies;
create policy "Users can update own companies"
  on public.companies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own companies" on public.companies;
create policy "Users can delete own companies"
  on public.companies for delete
  using (auth.uid() = user_id);
