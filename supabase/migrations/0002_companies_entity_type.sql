-- Migration 0002: Add entity_type to companies + individual-specific fields
-- An "entity" in the archive is either an individual (sole proprietor) or a
-- company (corporation). They share most fields; individuals additionally
-- carry personal social security numbers.

alter table public.companies
  add column if not exists entity_type text not null default 'company'
    check (entity_type in ('individual', 'company')),
  add column if not exists sss_no text,
  add column if not exists philhealth_no text,
  add column if not exists pagibig_no text;

create index if not exists companies_entity_type_idx on public.companies(entity_type);
