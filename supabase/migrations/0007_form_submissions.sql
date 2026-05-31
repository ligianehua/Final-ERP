-- Migration 0007: form_submissions table
-- A single filed form (draft, completed, or filed). The field_values jsonb
-- stores the resolved key/value pairs for the form's fields.

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  form_code text not null,
  status text not null default 'draft' check (status in ('draft', 'completed', 'filed')),
  period text,
  field_values jsonb not null default '{}'::jsonb,
  source_image_path text,
  output_pdf_path text,
  filed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists form_submissions_company_id_idx on public.form_submissions(company_id);
create index if not exists form_submissions_user_id_idx on public.form_submissions(user_id);
create index if not exists form_submissions_status_idx on public.form_submissions(status);

drop trigger if exists form_submissions_updated_at on public.form_submissions;
create trigger form_submissions_updated_at
  before update on public.form_submissions
  for each row execute function public.handle_updated_at();

alter table public.form_submissions enable row level security;

drop policy if exists "Users view own submissions" on public.form_submissions;
create policy "Users view own submissions"
  on public.form_submissions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own submissions" on public.form_submissions;
create policy "Users insert own submissions"
  on public.form_submissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own submissions" on public.form_submissions;
create policy "Users update own submissions"
  on public.form_submissions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own submissions" on public.form_submissions;
create policy "Users delete own submissions"
  on public.form_submissions for delete
  using (auth.uid() = user_id);
