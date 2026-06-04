-- Migration 0004: Supabase Storage bucket for documents
-- Files live at: documents/{user_id}/{company_id}/{uuid}-{filename}
-- RLS ensures users can only access objects under their own user_id folder.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- View own files
drop policy if exists "Users can view own document files" on storage.objects;
create policy "Users can view own document files"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Upload to own folder
drop policy if exists "Users can upload own document files" on storage.objects;
create policy "Users can upload own document files"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update own files
drop policy if exists "Users can update own document files" on storage.objects;
create policy "Users can update own document files"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete own files
drop policy if exists "Users can delete own document files" on storage.objects;
create policy "Users can delete own document files"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
