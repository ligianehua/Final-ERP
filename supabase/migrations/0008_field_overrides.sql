-- Migration 0008: per-submission layout overrides
--
-- Stores user drag-adjustments to field positions on the printed form
-- for this submission only. Shape: { [field_id]: { dx, dy } } with dx/dy
-- as deltas in PDF points from the template's default coordinate. Empty
-- by default — most submissions use the template's positions unchanged.

alter table public.form_submissions
  add column if not exists field_overrides jsonb not null default '{}'::jsonb;
