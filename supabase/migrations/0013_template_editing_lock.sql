-- Migration 0013: admin template editing lock
--
-- Prevents two admins from silently stomping each other's schema /
-- layout edits on the same template. A column trio on form_templates
-- tracks who currently holds the lock and when they last refreshed
-- it; the API treats anything older than 2 minutes as stale (the
-- holder probably closed the tab without releasing) so anyone can
-- reclaim it without an admin-on-admin support ticket.

alter table public.form_templates
  add column if not exists editing_by uuid references auth.users(id) on delete set null,
  add column if not exists editing_by_email text,
  add column if not exists editing_at timestamptz;

-- Quick lookup for the "stale lock" sweep (if/when we wire one).
create index if not exists form_templates_editing_at_idx
  on public.form_templates (editing_at)
  where editing_at is not null;
