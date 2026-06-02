-- Migration 0012: user-uploaded template storage + DB-first template metadata
--
-- form_templates already carries field_mapping (Phase 2c) + source_url
-- (Phase 7 cron). This adds the rest needed for a fully DB-described
-- template: the PDF location in Storage, page count + dimensions for
-- the editor, the field schema, and who uploaded it.
--
-- A new public storage bucket `templates` holds the source PDFs and
-- their per-page PNGs. Templates are public reference data (gov forms,
-- bank application forms, etc.) — no PII — so the bucket is public.

-- 1) Extra columns on form_templates ---------------------------------

alter table public.form_templates
  add column if not exists pdf_storage_path text,
  add column if not exists png_storage_prefix text,
  add column if not exists dimensions jsonb,
  add column if not exists field_schema jsonb,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- form_templates.is_active already exists from migration 0006; nothing
-- to add there.

-- 2) templates Storage bucket ---------------------------------------

insert into storage.buckets (id, name, public)
values ('templates', 'templates', true)
on conflict (id) do nothing;

-- Bucket is public so the WYSIWYG editor can render the page PNGs as
-- <img src=...> directly. Anyone can read; only authenticated users
-- can write — we'll gate "who can write" via the API (admin-only),
-- not at the storage layer.

drop policy if exists "Templates publicly readable" on storage.objects;
create policy "Templates publicly readable"
  on storage.objects for select
  using (bucket_id = 'templates');

drop policy if exists "Authenticated users can upload templates" on storage.objects;
create policy "Authenticated users can upload templates"
  on storage.objects for insert
  with check (bucket_id = 'templates' and auth.uid() is not null);

drop policy if exists "Authenticated users can update templates" on storage.objects;
create policy "Authenticated users can update templates"
  on storage.objects for update
  using (bucket_id = 'templates' and auth.uid() is not null);

drop policy if exists "Authenticated users can delete templates" on storage.objects;
create policy "Authenticated users can delete templates"
  on storage.objects for delete
  using (bucket_id = 'templates' and auth.uid() is not null);
