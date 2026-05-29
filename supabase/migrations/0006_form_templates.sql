-- Migration 0006: form_templates + seed
-- The catalog of government forms Quill knows how to recognize and (later)
-- fill. Pre-populated with the 5 priority forms from the MVP plan.

create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  form_code text unique not null,
  form_name text not null,
  agency text not null,
  frequency text check (frequency in ('monthly', 'annual', 'per_payment', 'quarterly')),
  description text,
  visual_hints text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists form_templates_form_code_idx on public.form_templates(form_code);

-- form_templates are reference data — everyone can read, only no inserts
-- from clients (we seed via migration). Enable RLS but allow SELECT for all
-- authenticated users.
alter table public.form_templates enable row level security;

drop policy if exists "Anyone can read form templates" on public.form_templates;
create policy "Anyone can read form templates"
  on public.form_templates for select
  using (true);

-- Seed the 5 priority forms
insert into public.form_templates (form_code, form_name, agency, frequency, description, visual_hints)
values
  (
    'BIR_2550M',
    'Monthly VAT Declaration',
    'BIR',
    'monthly',
    'Monthly Value-Added Tax Declaration filed by VAT-registered taxpayers',
    'Header contains "BIR Form 2550M" and "Monthly Value-Added Tax Declaration". Issued by Bureau of Internal Revenue. Has fields for taxable sales, output tax, input tax, VAT payable.'
  ),
  (
    'MAYORS_PERMIT_RENEWAL',
    'Mayor''s Permit Renewal',
    'LGU',
    'annual',
    'Annual business permit renewal form filed at the City/Municipal Hall',
    'Header mentions "Mayor''s Permit", "Business Permit", or "Renewal". Issued by a Philippine city or municipality (e.g., "City Government of Quezon City"). Has fields for business name, owner, address, line of business, capitalization.'
  ),
  (
    'BIR_0605',
    'Payment Form',
    'BIR',
    'per_payment',
    'General BIR payment form for various tax types',
    'Header contains "BIR Form 0605" and "Payment Form". Has fields for tax type, period, ATC, amount due. Used to pay any BIR tax (annual registration fee, deficiency taxes, etc.).'
  ),
  (
    'SEC_GIS',
    'General Information Sheet',
    'SEC',
    'annual',
    'Annual GIS filed by corporations with the SEC',
    'Header says "General Information Sheet" with SEC logo or "Securities and Exchange Commission". Has sections for corporate name, SEC registration number, principal office, directors/officers, stockholders.'
  ),
  (
    'SSS_R3',
    'Contribution Collection List',
    'SSS',
    'monthly',
    'Monthly contribution remittance list submitted to SSS by employers',
    'Header contains "SSS Form R-3" or "Contribution Collection List". Issued by Social Security System. Has a table of employee SS numbers, names, and contribution amounts.'
  )
on conflict (form_code) do nothing;
