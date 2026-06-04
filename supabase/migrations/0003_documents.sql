-- Migration 0003: documents table
-- Each row represents one uploaded file (permit, certificate, etc.) belonging
-- to an entity. The file itself lives in Supabase Storage; this table holds
-- the metadata + a path pointer + any AI-extracted fields.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type text not null,
  folder text not null check (folder in (
    'business_permits',
    'tax',
    'hr_social',
    'financial',
    'other'
  )),
  document_number text,
  issued_date date,
  expiry_date date,
  issuing_authority text,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  extracted_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_company_id_idx on public.documents(company_id);
create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_folder_idx on public.documents(folder);
create index if not exists documents_expiry_date_idx on public.documents(expiry_date)
  where expiry_date is not null;

alter table public.documents enable row level security;

drop policy if exists "Users can view own documents" on public.documents;
create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own documents" on public.documents;
create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);
