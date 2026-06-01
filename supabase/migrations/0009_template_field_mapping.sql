-- Migration 0009: per-template default field layout
--
-- Admins can adjust the WYSIWYG layout and save it as the new default
-- for everyone. The merged coordinate map lives here; absence means
-- "use whatever the code-side TemplateConfig ships with" (i.e. the
-- factory defaults baked into `src/lib/forms/templates/<form>.ts`).
--
-- Shape: { [field_id]: { page, x, y, width?, height?, size?, align? } }

alter table public.form_templates
  add column if not exists field_mapping jsonb;
