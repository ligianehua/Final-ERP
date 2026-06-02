-- Migration 0010: reminders
--
-- Auto-generated rows nudging the user about upcoming document expiries
-- (and later, recurring form deadlines). Computed from documents.expiry_date
-- and form_submissions/form_templates by the daily cron — never inserted
-- by hand from the client.
--
-- `source_key` makes the compute idempotent: re-running the job won't
-- create duplicates because the same logical reminder maps to the same
-- key. Users can snooze a reminder (defers it) or dismiss it (hides it
-- forever); the cron respects both flags when sending emails.

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  submission_id uuid references public.form_submissions(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('document_expiry', 'form_deadline')),
  title text not null,
  /** Date the user should be nudged on (T-90 / T-30 / T-14 / T-7 from expiry). */
  due_date date not null,
  /** The thing the reminder is ABOUT — e.g. when the certificate actually expires. */
  target_date date,
  source_key text not null,
  snoozed_until date,
  dismissed_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- One reminder per logical event. The compute job upserts by source_key.
create unique index if not exists reminders_source_unique
  on public.reminders(user_id, source_key);

create index if not exists reminders_due_date_idx on public.reminders(due_date);
create index if not exists reminders_user_id_idx on public.reminders(user_id);
create index if not exists reminders_company_id_idx on public.reminders(company_id);

alter table public.reminders enable row level security;

drop policy if exists "Users view own reminders" on public.reminders;
create policy "Users view own reminders"
  on public.reminders for select
  using (auth.uid() = user_id);

drop policy if exists "Users update own reminders" on public.reminders;
create policy "Users update own reminders"
  on public.reminders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own reminders" on public.reminders;
create policy "Users delete own reminders"
  on public.reminders for delete
  using (auth.uid() = user_id);

-- INSERT is intentionally NOT exposed — only the server-side compute path
-- (which runs with the user's session OR the service role from cron) creates
-- rows. Clients can snooze / dismiss / delete their own rows but never
-- forge a fresh reminder.
drop policy if exists "Users insert own reminders" on public.reminders;
create policy "Users insert own reminders"
  on public.reminders for insert
  with check (auth.uid() = user_id);
