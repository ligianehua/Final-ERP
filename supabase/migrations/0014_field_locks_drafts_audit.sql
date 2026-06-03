-- Migration 0014: field-level locks, cloud-synced fill drafts, audit log
--
-- Three related additions, grouped into one migration because they
-- collectively round out the "multiple admins working on a template
-- at the same time" story:
--
--   a) editing_fields: per-field lock map on form_templates. The
--      template-level lock (0013) prevents Replace-PDF / bulk schema
--      stomping, but two admins should be able to drag different
--      fields without taking over each other.
--
--   b) form_drafts: cloud copy of in-progress fill data so a user
--      can start on their laptop and finish on their phone. The
--      localStorage draft (kept) is the offline fallback; the row
--      here is the authoritative cross-device copy.
--
--   c) audit_log: who-did-what trail for admin template edits. Used
--      to debug "who broke this template" tickets.

-- a) Presence + per-field locks ------------------------------------
--
-- 0013 modelled exclusive editing — one admin in, everyone else
-- viewer. With field-level locks we can do better: many admins can
-- coexist on the same template as long as they're editing different
-- fields. editing_sessions tracks who's currently on the page (each
-- heartbeats every 10s into their own slot, stale after 2 min);
-- editing_fields tracks which specific fields each admin is
-- actively dragging / inline-editing.
--
-- The legacy editing_by / editing_by_email / editing_at columns from
-- 0013 stay on the table but stop being read. They'd be dropped in a
-- later cleanup migration; today the API just leaves them null.

alter table public.form_templates
  add column if not exists editing_sessions jsonb not null default '{}'::jsonb,
  add column if not exists editing_fields jsonb not null default '{}'::jsonb;

-- b) Cloud fill drafts ----------------------------------------------

create table if not exists public.form_drafts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  form_code    text not null,
  company_id   uuid references public.companies(id) on delete cascade,
  signatory_id uuid references public.signatories(id) on delete set null,
  values       jsonb not null default '{}'::jsonb,
  overrides    jsonb not null default '{}'::jsonb,
  period       text,
  updated_at   timestamptz not null default now()
);

-- One draft per (user, form, company, signatory) slot — matches the
-- localStorage key tuple the fill flow already uses.
create unique index if not exists form_drafts_slot_uidx
  on public.form_drafts (
    user_id,
    form_code,
    coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(signatory_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists form_drafts_user_idx
  on public.form_drafts (user_id, updated_at desc);

alter table public.form_drafts enable row level security;

-- Each user only ever sees / writes their own drafts.
drop policy if exists "form_drafts_owner_select" on public.form_drafts;
create policy "form_drafts_owner_select" on public.form_drafts
  for select using (auth.uid() = user_id);

drop policy if exists "form_drafts_owner_modify" on public.form_drafts;
create policy "form_drafts_owner_modify" on public.form_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- c) Admin audit log -----------------------------------------------

create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,
  target_kind text not null,
  target_id   text not null,
  before      jsonb,
  after       jsonb,
  at          timestamptz not null default now()
);

create index if not exists audit_log_target_idx
  on public.audit_log (target_kind, target_id, at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id, at desc);
create index if not exists audit_log_at_idx
  on public.audit_log (at desc);

-- Only admins should read this; writes go through service-role-only
-- endpoints. We enforce admin gating in the API layer (isAdminEmail)
-- rather than via RLS because the admin allowlist lives in env vars,
-- not in the database. Leave RLS off so the API has a free hand.
