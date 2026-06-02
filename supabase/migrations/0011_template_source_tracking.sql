-- Migration 0011: template source tracking
--
-- Lets the daily cron poll each form's official source URL, hash the
-- response, and flag admins when the government has published a new
-- version. The cron NEVER auto-replaces the template — it only emails
-- so a human can verify before swapping the file.

alter table public.form_templates
  add column if not exists source_url text,
  add column if not exists source_hash text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_changed_at timestamptz;

-- Seed canonical source URLs for the forms we already ship. (BIR 2550M
-- is the only one we have a baked template for today; the rest still
-- carry the URL so the cron can watch them and alert admins.)
update public.form_templates
   set source_url = 'https://www.bir.gov.ph/bir-forms?tab=VAT/Percentage+Tax+Returns&idTag=BIR2550M'
 where form_code = 'BIR_2550M' and source_url is null;

update public.form_templates
   set source_url = 'https://bir-cdn.bir.gov.ph/local/pdf/0605version1999_09.02.2022_copy.pdf'
 where form_code = 'BIR_0605' and source_url is null;

update public.form_templates
   set source_url = 'https://www.sec.gov.ph/reportorial-requirements/corporations-with-primary-licenses'
 where form_code = 'SEC_GIS' and source_url is null;

update public.form_templates
   set source_url = 'https://www.sss.gov.ph/wp-content/uploads/2022/03/SSSForms_Contribution_Collection_List.pdf'
 where form_code = 'SSS_R3' and source_url is null;
